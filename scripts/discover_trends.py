"""
Weekly K-food trend discovery.

Sources:
  1. Google Trends — rising US search queries for K-food
  2. Reddit — viral posts from K-food subreddits this week
  3. Naver DataLab — Korean search trends (optional; needs NAVER_CLIENT_ID / NAVER_CLIENT_SECRET)

Output: markdown to stdout → piped into a GitHub Issue by the Actions workflow.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta


# ── Google Trends ────────────────────────────────────────────────────────────

GTRENDS_SEEDS = [
    'korean food',
    'korean snack',
    'korean dessert',
    'kfood',
    'korean recipe',
]

def _pytrends_rising_for(pytrends, term):
    try:
        pytrends.build_payload([term], timeframe='now 7-d', geo='US')
        related = pytrends.related_queries()
        rising_df = related.get(term, {}).get('rising')
        if rising_df is None or rising_df.empty:
            return {}
        results = {}
        for _, row in rising_df.head(15).iterrows():
            q = row['query'].strip().lower()
            v = row['value']  # int (% increase) or string 'Breakout'
            results[q] = v
        return results
    except Exception as e:
        print(f"  [warn] pytrends error for '{term}': {e}", file=sys.stderr)
        return {}

def fetch_google_trends():
    try:
        from pytrends.request import TrendReq
    except ImportError:
        print("[warn] pytrends not installed — skipping Google Trends", file=sys.stderr)
        return {}

    print("Fetching Google Trends ...", file=sys.stderr)
    pytrends = TrendReq(hl='en-US', tz=0, timeout=(10, 30), retries=2, backoff_factor=0.5)

    merged = {}
    for seed in GTRENDS_SEEDS:
        result = _pytrends_rising_for(pytrends, seed)
        for q, v in result.items():
            # Keep the highest value if seen from multiple seeds
            if q not in merged:
                merged[q] = v
            else:
                existing = merged[q]
                # 'Breakout' wins over any number
                if existing != 'Breakout' and (v == 'Breakout' or (isinstance(v, (int, float)) and isinstance(existing, (int, float)) and v > existing)):
                    merged[q] = v
        time.sleep(3)  # avoid rate limiting

    return merged


# ── Reddit ───────────────────────────────────────────────────────────────────

REDDIT_SUBS = ['KoreanFood', 'asianfood', 'instantramen', 'HealthyFood']
REDDIT_MIN_SCORE = 100

def fetch_reddit_posts():
    print("Fetching Reddit posts ...", file=sys.stderr)
    headers = {'User-Agent': 'sourceat-trend-bot/1.0 (github.com/sourceat-v/sourceat)'}
    posts = []

    for sub in REDDIT_SUBS:
        url = f'https://www.reddit.com/r/{sub}/top.json?t=week&limit=25'
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            for child in data['data']['children']:
                p = child['data']
                if p.get('stickied') or p.get('score', 0) < REDDIT_MIN_SCORE:
                    continue
                posts.append({
                    'sub': sub,
                    'title': p['title'],
                    'score': p['score'],
                    'comments': p.get('num_comments', 0),
                    'url': 'https://reddit.com' + p['permalink'],
                })
            time.sleep(1)
        except Exception as e:
            print(f"  [warn] Reddit error for r/{sub}: {e}", file=sys.stderr)

    posts.sort(key=lambda x: x['score'], reverse=True)
    return posts[:20]


# ── Naver DataLab (optional) ─────────────────────────────────────────────────
# Tracks what Koreans are searching for — leading indicator before US trends.
# Needs NAVER_CLIENT_ID + NAVER_CLIENT_SECRET in environment / GitHub Secrets.
# Register at: https://developers.naver.com/apps/#/register

NAVER_FOOD_CATEGORIES = [
    ('디저트', ['약과', '두바이초콜릿', '마라탕', '탕후루', '크로플']),
    ('즉석식품', ['햇반', '즉석밥', '컵밥', '편의점도시락']),
    ('과자', ['버터떡', '인절미과자', '흑임자쿠키', '쑥쿠키']),
    ('음료', ['유자차', '흑임자라떼', '식혜', '수정과']),
]

def fetch_naver_trends():
    client_id = os.environ.get('NAVER_CLIENT_ID', '').strip()
    client_secret = os.environ.get('NAVER_CLIENT_SECRET', '').strip()
    if not client_id or not client_secret:
        print("[info] No Naver API keys — skipping Naver DataLab", file=sys.stderr)
        return []

    print("Fetching Naver DataLab ...", file=sys.stderr)

    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=30)
    date_fmt = '%Y-%m-%d'

    results = []

    for category_name, keywords in NAVER_FOOD_CATEGORIES:
        keyword_groups = [{'groupName': kw, 'keywords': [kw]} for kw in keywords]
        body = json.dumps({
            'startDate': start_date.strftime(date_fmt),
            'endDate': end_date.strftime(date_fmt),
            'timeUnit': 'week',
            'keywordGroups': keyword_groups,
        }).encode('utf-8')

        req = urllib.request.Request(
            'https://openapi.naver.com/v1/datalab/search',
            data=body,
            headers={
                'X-Naver-Client-Id': client_id,
                'X-Naver-Client-Secret': client_secret,
                'Content-Type': 'application/json',
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())

            for item in data.get('results', []):
                name = item['title']
                ratios = [p['ratio'] for p in item.get('data', [])]
                if len(ratios) < 2:
                    continue
                recent = ratios[-1]
                prev = ratios[-2] if ratios[-2] > 0 else 0.1
                change_pct = round((recent - prev) / prev * 100) if prev else 0
                results.append({
                    'keyword': name,
                    'category': category_name,
                    'recent_ratio': recent,
                    'change_pct': change_pct,
                })
        except Exception as e:
            print(f"  [warn] Naver API error for '{category_name}': {e}", file=sys.stderr)
        time.sleep(0.5)

    results.sort(key=lambda x: x['change_pct'], reverse=True)
    return results[:15]


# ── Report builder ────────────────────────────────────────────────────────────

def _sort_key_trends(item):
    q, v = item
    if v == 'Breakout':
        return (0, 0)
    return (1, -int(v) if isinstance(v, (int, float)) else 0)

def build_report(google_trends, reddit_posts, naver_trends):
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    lines = [
        f'## K-Food 트렌드 후보 — {today}',
        '',
        '자동 수집된 이번 주 트렌드 후보입니다. 페이지로 만들 항목에 체크하세요.',
        '',
    ]

    # ── Google Trends ──
    lines += ['### 📈 Google Trends — 미국 급상승 검색어', '']
    if google_trends:
        for q, v in sorted(google_trends.items(), key=_sort_key_trends)[:20]:
            badge = '🚀 Breakout' if v == 'Breakout' else f'+{v}%'
            lines.append(f'- **{q}** ({badge})')
    else:
        lines.append('- 데이터 없음 (Google Trends 접근 실패 또는 해당 주 데이터 부족)')

    lines.append('')

    # ── Naver (Korean trends) ──
    if naver_trends:
        lines += ['### 🇰🇷 Naver DataLab — 한국 검색 급상승 (지난 4주)', '']
        for item in naver_trends:
            arrow = '▲' if item['change_pct'] >= 0 else '▼'
            lines.append(f"- **{item['keyword']}** ({item['category']}) — {arrow} {abs(item['change_pct'])}% vs 전주")
        lines.append('')

    # ── Reddit ──
    lines += ['### 🔴 Reddit — 이번 주 인기 포스트', '']
    if reddit_posts:
        for p in reddit_posts:
            lines.append(f"- [{p['title']}]({p['url']}) · r/{p['sub']} · ↑{p['score']} · {p['comments']}댓글")
    else:
        lines.append('- 데이터 없음')

    lines += [
        '',
        '---',
        '### ✅ 다음 액션',
        '- [ ] 새 트렌드 페이지로 만들 항목 선택',
        '- [ ] `js/app.js` TRENDS 배열에 상품 데이터 추가',
        '- [ ] `{slug}.html` 카테고리 페이지 작성',
        '- [ ] `index.html` mag-card 추가',
        '- [ ] `vercel.json` rewrite 추가',
        '',
        '_이 이슈는 GitHub Actions에서 자동 생성됩니다. 매주 월요일 KST 오전._',
    ]

    return '\n'.join(lines)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    google_trends = fetch_google_trends()
    reddit_posts  = fetch_reddit_posts()
    naver_trends  = fetch_naver_trends()

    report = build_report(google_trends, reddit_posts, naver_trends)
    print(report)
