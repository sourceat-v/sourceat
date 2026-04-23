"""
$ourceat — Daily trend updater
매일 실행: 트렌딩 K-food 탐지 → Claude로 큐레이션 → Firestore 저장
"""

import os
import json
import sys
from urllib.parse import quote_plus
import anthropic
import firebase_admin
from firebase_admin import credentials, firestore
from ddgs import DDGS
from datetime import datetime, timezone


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


# ── Claude로 트렌드 생성 ──────────────────────────────────
def generate_trends(search_results):
    client = anthropic.Anthropic()

    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    context = "\n".join(
        f"- {r['title']}: {r.get('body', '')[:200]}"
        for r in search_results[:20]
    )

    prompt = f"""Today is {today}. You are the curator for $ourceat, a website that helps Americans discover trending Korean food products.

Based on these recent search results about K-food trends:
{context}

Generate exactly 3 trending Korean food categories. Each must have 4-5 specific, real packaged products that are actually available in the US market.

Rules:
- Only use real, existing Korean food brands: Samyang, Nongshim, Ottogi, CJ, Pulmuone, Lotte, Orion, Binggrae, Haitai, etc.
- Products must be actually sold in the US (Amazon, H-Mart, Weee!, Wooltari)
- Amazon URL: use Amazon search URL format https://www.amazon.com/s?k=SEARCH+TERMS
- Leave hmart/weee/wooltari price as null (will be filled manually)
- Make descriptions specific and useful for Americans unfamiliar with K-food
- One trend should be "🔥 Hot" (t-hot), one "📈 Rising" (t-rising), one "🚀 Viral" (t-viral)
- channels options: TikTok, YouTube, Instagram, Reddit, Netflix, NYT Food, K-Drama

Return ONLY valid JSON with this exact structure, no markdown:
{{
  "trends": [
    {{
      "trend_id": "short_snake_case_id",
      "title": "Trend Title",
      "tag": "🔥 Hot",
      "tag_style": "t-hot",
      "channels": ["TikTok", "YouTube"],
      "search_kr": "한국어 검색어 (예: 불닭볶음면 챌린지)",
      "desc": "2-3 sentence description explaining why this is trending and what it is",
      "products": [
        {{
          "product_id": "unique_id",
          "name": "Exact Product Name (size/count)",
          "brand": "Brand Name",
          "desc": "One sentence: what it tastes like and why Americans should try it.",
          "img_url": "",
          "shops": {{
            "amazon": {{"price": null, "url": "https://www.amazon.com/s?k=product+name+brand"}},
            "hmart":  {{"price": null, "url": null}},
            "weee":   {{"price": null, "url": null}},
            "wooltari": {{"price": null, "url": null}}
          }}
        }}
      ]
    }}
  ]
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()

    # JSON 파싱 — 마크다운 펜스 제거
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    start = raw.find("{")
    end = raw.rfind("}") + 1
    return json.loads(raw[start:end])


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
            shops = product.setdefault('shops', {})
            if not shops.get('amazon', {}).get('url'):
                shops['amazon']   = {'price': None, 'url': f'https://www.amazon.com/s?k={q}'}
            if not shops.get('hmart', {}).get('url'):
                shops['hmart']    = {'price': None, 'url': f'https://www.hmart.com/search?query={q}'}
            if not shops.get('weee', {}).get('url'):
                shops['weee']     = {'price': None, 'url': f'https://www.sayweee.com/search?keyword={q}'}
            if not shops.get('wooltari', {}).get('url'):
                shops['wooltari'] = {'price': None, 'url': f'https://www.wooltariusa.com/search?q={q}'}
    return trends_data


# ── 제품 이미지 검색 ──────────────────────────────────────
def find_product_images(trends_data):
    found = 0
    with DDGS() as ddgs:
        for trend in trends_data['trends']:
            for product in trend['products']:
                if product.get('img_url'):
                    continue
                query = f"{product['brand']} {product['name']} korean food product"
                try:
                    imgs = list(ddgs.images(query, max_results=1))
                    if imgs:
                        product['img_url'] = imgs[0]['image']
                        found += 1
                except Exception as e:
                    pass
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
    print(f"=== $ourceat 트렌드 업데이트 시작 ({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}) ===")

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
