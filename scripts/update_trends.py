"""
sourceat — Daily trend updater
매일 실행: 트렌딩 K-food 탐지 → Claude로 큐레이션 → Firestore 저장
"""

import os
import json
import sys
import requests
from urllib.parse import quote_plus, quote
import anthropic
import firebase_admin
from firebase_admin import credentials, firestore
from ddgs import DDGS
from datetime import datetime, timezone

_HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; sourceat-bot/1.0)'}


# ── 웹 검색 ───────────────────────────────────────────────
def search_kfood_trends():
    queries = [
        "Korean food viral TikTok Instagram 2026",
        "K-food trending products America 2026",
        "Korean snacks convenience store popular 2026",
        "Korean food new product launch viral",
    ]
    results = []
    with DDGS() as ddgs:
        for q in queries:
            try:
                hits = list(ddgs.text(q, max_results=5))
                results.extend(hits)
            except Exception as e:
                print(f"검색 실패 ({q}): {e}")
    return results


# ── Tool schema for structured output ────────────────────
_SHOP = {
    "type": "object",
    "properties": {
        "price": {"type": ["number", "null"]},
        "url":   {"type": ["string", "null"]},
    },
    "required": ["price", "url"],
}

_SAVE_TRENDS_TOOL = {
    "name": "save_trends",
    "description": "Save the curated K-food trends",
    "input_schema": {
        "type": "object",
        "properties": {
            "trends": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "properties": {
                        "trend_id":   {"type": "string"},
                        "title":      {"type": "string"},
                        "tag":        {"type": "string"},
                        "tag_style":  {"type": "string"},
                        "channels":   {"type": "array", "items": {"type": "string"}},
                        "search_kr":  {"type": "string"},
                        "desc":       {"type": "string"},
                        "products": {
                            "type": "array",
                            "minItems": 5,
                            "maxItems": 5,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "product_id": {"type": "string"},
                                    "name":       {"type": "string"},
                                    "brand":      {"type": "string"},
                                    "desc":       {"type": "string"},
                                    "img_url":    {"type": "string"},
                                    "shops": {
                                        "type": "object",
                                        "properties": {
                                            "amazon":   _SHOP,
                                            "hmart":    _SHOP,
                                            "weee":     _SHOP,
                                            "wooltari": _SHOP,
                                            "yamibuy":  _SHOP,
                                        },
                                        "required": ["amazon", "hmart", "weee", "wooltari", "yamibuy"],
                                    },
                                },
                                "required": ["product_id", "name", "brand", "desc", "shops"],
                            },
                        },
                    },
                    "required": ["trend_id", "title", "tag", "tag_style", "channels", "search_kr", "desc", "products"],
                },
            },
        },
        "required": ["trends"],
    },
}


# ── Claude로 트렌드 생성 ──────────────────────────────────
def generate_trends(search_results):
    client = anthropic.Anthropic()

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    context = "\n".join(
        f"- {r['title']}: {r.get('body', '')[:200]}"
        for r in search_results[:20]
    )

    prompt = f"""Today is {today}. You are the curator for sourceat, a website that helps Americans discover trending Korean food products.

Based on these recent search results about K-food trends:
{context}

Generate exactly 3 trending Korean food categories. Each must have exactly 5 specific, real packaged products that are actually available in the US market.

Rules:
- Only use real, existing Korean food brands: Samyang, Nongshim, Ottogi, CJ, Pulmuone, Lotte, Orion, Binggrae, Haitai, etc.
- Products must be actually sold in the US (Amazon, H-Mart, Weee!, Wooltari, Yami)
- Amazon URL: use Amazon search URL format https://www.amazon.com/s?k=SEARCH+TERMS
- Yamibuy URL: use Yami search URL format https://www.yami.com/search?q=SEARCH+TERMS
- Leave hmart/weee/wooltari price as null and url as null (will be filled manually)
- Make descriptions specific and useful for Americans unfamiliar with K-food
- One trend should be "🔥 Hot" (t-hot), one "📈 Rising" (t-rising), one "🚀 Viral" (t-viral)
- channels options: TikTok, YouTube, Instagram, Reddit, Netflix, NYT Food, K-Drama
- Include variety within each trend: different flavors, sizes, brands, or sub-categories

Call the save_trends tool with your curated data."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        tools=[_SAVE_TRENDS_TOOL],
        tool_choice={"type": "tool", "name": "save_trends"},
        messages=[{"role": "user", "content": prompt}],
    )

    if response.stop_reason == "max_tokens":
        raise RuntimeError("max_tokens 초과 — tool input 잘림")

    tool_use = next(b for b in response.content if b.type == "tool_use")
    data = tool_use.input
    print(f"    tool_use.input keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")

    # Normalize: API may return array directly instead of {"trends": [...]}
    if isinstance(data, list):
        return {"trends": data}
    if "trends" not in data:
        # Try to find a list value inside the dict
        for v in data.values():
            if isinstance(v, list) and len(v) == 3:
                return {"trends": v}
        raise ValueError(f"Cannot find trends in tool input: {list(data.keys())}")
    return data


# ── 소셜 플랫폼 링크 생성 ─────────────────────────────────
PLATFORM_URLS = {
    'YouTube':   lambda q: f'https://www.youtube.com/results?search_query={q}',
    'TikTok':    lambda q: f'https://www.tiktok.com/search?q={q}',
    'Instagram': lambda q: f'https://www.instagram.com/explore/search/keyword/?q={q}',
    'Reddit':    lambda q: f'https://www.reddit.com/search/?q={q}',
    'Netflix':   lambda q: f'https://www.netflix.com/search?q={q}',
    'NYT Food':  lambda q: f'https://www.nytimes.com/search?query={q}',
    'K-Drama':   lambda q: f'https://www.youtube.com/results?search_query={q}+k+drama',
}

def add_social_links(trends_data):
    for trend in trends_data['trends']:
        # 한국어 검색어 우선, 없으면 영어 제목
        kr = trend.get('search_kr', '').strip()
        q_kr = quote_plus(kr) if kr else quote_plus(trend['title'])
        trend['social_links'] = {
            ch: PLATFORM_URLS[ch](q_kr)
            for ch in trend.get('channels', [])
            if ch in PLATFORM_URLS
        }
    return trends_data


# ── 쇼핑몰 검색 URL 자동 생성 ────────────────────────────
def add_retailer_urls(trends_data):
    for trend in trends_data['trends']:
        for product in trend['products']:
            q = quote_plus(f"{product['brand']} {product['name']}")
            q_hmart = quote(f"{product['brand']} {product['name']}", safe='')
            shops = product.setdefault('shops', {})
            if not shops.get('amazon', {}).get('url'):
                shops['amazon']   = {'price': None, 'url': f'https://www.amazon.com/s?k={q}'}
            if not shops.get('hmart', {}).get('url'):
                shops['hmart']    = {'price': None, 'url': f'https://www.hmart.com/{q_hmart}?_q={q_hmart}&map=ft'}
            if not shops.get('weee', {}).get('url'):
                shops['weee']     = {'price': None, 'url': f'https://www.sayweee.com/search?keyword={q}'}
            if not shops.get('wooltari', {}).get('url'):
                shops['wooltari'] = {'price': None, 'url': f'https://www.wooltariusa.com/search?q={q}'}
            if not shops.get('yamibuy', {}).get('url'):
                shops['yamibuy']  = {'price': None, 'url': f'https://www.yami.com/search?q={q}'}
    return trends_data


# ── 제품 이미지 검색 ──────────────────────────────────────
def _og_image_from_url(url):
    """URL에서 og:image 추출."""
    try:
        r = requests.get(url, headers=_HEADERS, timeout=6)
        for prefix in ['og:image" content="', 'property="og:image" content="',
                        "og:image' content='", 'og:image" content=\'']:
            idx = r.text.find(prefix)
            if idx != -1:
                start = idx + len(prefix)
                end = r.text.find(r.text[start - 1], start)
                img = r.text[start:end]
                if img.startswith('http'):
                    return img
    except Exception:
        pass
    return None


def find_product_images(trends_data):
    found = 0
    with DDGS() as ddgs:
        for trend in trends_data['trends']:
            for product in trend['products']:
                product['img_url'] = ''
                base = f"{product['brand']} {product['name']}"

                # 텍스트 검색 결과 URL들에서 순서대로 og:image 시도
                for query in [f"{base} buy", f"{base} korean food"]:
                    try:
                        results = list(ddgs.text(query, max_results=5))
                        for r in results:
                            img = _og_image_from_url(r.get('href', ''))
                            if img:
                                product['img_url'] = img
                                found += 1
                                break
                    except Exception:
                        pass
                    if product.get('img_url'):
                        break

                if not product.get('img_url'):
                    print(f"    이미지 없음: {base}")

    print(f"    이미지 {found}개 수집")
    return trends_data


# ── Firestore 저장 ────────────────────────────────────────
def save_to_firestore(trends_data):
    db = firestore.client()
    db.collection("site_data").document("trends").set({
        "data": trends_data["trends"],
        "updatedAt": firestore.SERVER_TIMESTAMP,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    })
    print(f"Firestore 저장 완료: {len(trends_data['trends'])} 트렌드")


# ── Firebase 초기화 ───────────────────────────────────────
def init_firebase():
    # GitHub Actions: 환경변수로 서비스 계정 JSON 전달
    sa_env = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if sa_env:
        sa_info = json.loads(sa_env)
        cred = credentials.Certificate(sa_info)
    else:
        # 로컬 개발: 파일로
        key_path = os.path.join(os.path.dirname(__file__), "firebase-service-account.json")
        if not os.path.exists(key_path):
            print("ERROR: firebase-service-account.json 없음")
            print("Firebase Console → Project Settings → Service Accounts → Generate new private key")
            sys.exit(1)
        cred = credentials.Certificate(key_path)

    firebase_admin.initialize_app(cred)


# ── 메인 ─────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"=== sourceat 트렌드 업데이트 시작 ({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}) ===")

    init_firebase()

    print("1/3 트렌드 검색 중...")
    results = search_kfood_trends()
    print(f"    검색 결과 {len(results)}개 수집")

    print("2/3 Claude로 큐레이션 생성 중...")
    trends = generate_trends(results)
    print(f"    트렌드 {len(trends['trends'])}개 생성")
    for t in trends["trends"]:
        print(f"    - [{t['tag']}] {t['title']} ({len(t['products'])}개 제품)")

    print("3/5 소셜 링크 생성 중...")
    trends = add_social_links(trends)

    print("4/5 쇼핑몰 URL 생성 중...")
    trends = add_retailer_urls(trends)

    print("5/5 이미지 검색 중...")
    trends = find_product_images(trends)

    print("6/6 Firestore 저장 중...")
    save_to_firestore(trends)

    print("=== 완료 ===")
