# 부동산팀 데이터 연결 카탈로그 (Data Sources)

> 우리 팀의 강점: 지표를 "문서상 정의"로 끝내지 않고 **실시간 도구에 직접 연결**한다.
> 아래는 지표별로 어떤 도구·코드를 호출하면 물이 흐르는지를 정리한 배관도다.

## 1. 거시·통화·금리 — 한국은행 ECOS

| 지표 | 도구 호출 | 코드/별칭 | 비고 |
|---|---|---|---|
| 기준금리(최신) | `koreaEcos-get_key_statistics(keyword="금리")` | — | 일 단위 최신값 |
| 기준금리(시계열) | `koreaEcos-search_statistic(stat_code="기준금리", cycle="D")` | `722Y001` / `0101000` | 날짜포맷 `YYYYMMDD` |
| M2 통화량 | `koreaEcos-search_statistic(stat_code="M2통화량")` | `161Y006` / `BBHA00` | 월, 십억원, 약 2개월 시차 |
| 예금은행 대출금리 | `koreaEcos-search_statistic(stat_code="121Y006")` | 121Y006(신규)/121Y015(잔액) | 주담대 세부항목 포함 |
| 지표 탐색 | `koreaEcos-search_statistic_table(keyword="...")` | — | 코드 찾을 때 트리 탐색 |

**주의:** `search_statistic`은 주기(cycle)와 날짜 포맷이 맞아야 한다. 월=`YYYYMM`, 일=`YYYYMMDD`, 분기=`YYYYQn`.
별칭(`기준금리`/`M2통화량` 등)은 자동 매핑되나, 기준금리를 월포맷으로 넣으면 오류 → 일포맷+`cycle="D"` 사용.

## 2. 실거래·시세 — 국토부/카카오/청약홈

| 용도 | 도구 호출 | 비고 |
|---|---|---|
| 아파트 실거래(매매/전월세) | `cheongyak-get_real_estate_market_data(region_name, property_type="아파트", trade_type="매매"\|"전월세")` | 구(區) 단위, `yyyymm` 지정 |
| 시세 조회 | `kakaoRealEstate-get_market_price(...)` | 단지 시세 |
| 매물 검색 | `kakaoRealEstate-search_property(...)` | 조건 검색 |
| 중간지점 매물 | `kakaoRealEstate-find_midpoint_property(...)` | 실거주 입지분석 |
| 청약 시장데이터 | `cheongyak-get_real_estate_market_data(...)` / `cheongyak-get_apply_detail(...)` | 청약 경쟁률·경쟁분석 |
| 청약 경쟁률 분석 | `cheongyak-analyze_competition(...)` | 아대리 활용 |

## 3. 정책·뉴스·심리 — 네이버 검색

| 용도 | 도구 호출 | 비고 |
|---|---|---|
| 부동산 정책 뉴스 | `NaverSearch-search_news(query="...", sort="date")` | 규제·대책·금통위 모니터링 |
| 시장 심리(카페) | `NaverSearch-search_cafearticle(query="...")` | 실수요자 체감 |
| 블로그/전문가 | `NaverSearch-search_blog(query="...")` | 현장 코멘트 |
| 검색 트렌드 | `NaverSearch-datalab_search(...)` | 관심도 급등 감지 |

## 4. 참고: 토지 담당(토대리) 데이터

- 공시지가/실거래: 국토부 실거래 도구 + 뉴스 크로스체크
- 개발호재·토지거래허가구역: `NaverSearch-search_news` / `search_local`
- 지도·입지: `KakaoMap-SearchPlaceByKeywordOpen`, 교통 접근성 도구군

---

## 호출 표준 규칙

1. **모든 수치에는 (값, 단위, 조회일자, 소스코드)를 함께 기록**한다.
2. 조회 결과는 `data/kpi-snapshot-YYYY-MM-DD.md`에 원자료로 적재한다.
3. 도구 오류 시 코드/주기/날짜포맷을 먼저 점검하고, 대체 도구(뉴스 등)로 교차검증한다.
