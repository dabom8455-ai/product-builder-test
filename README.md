# 도현컴퍼니 (가칭) — 회사 운영 매뉴얼

> 인공지능과 피아노 교육사업을 연계해 머니 파이프라인을 구축하고,
> **시간을 팔아 돈을 벌지 않고, 시스템을 팔아 시간을 사는 회사**

이 저장소는 우리 회사의 **뼈대(운영 매뉴얼)** 입니다.
말로만 하는 조직도가 아니라, 매일 열어보고 갱신하는 살아있는 문서입니다.

---

## 한눈에 보기

| 구분 | 내용 |
|------|------|
| **사업장** | 도현피아노 학원 (경기 용인시 처인구 모현읍) |
| **본질** | 학원 운영 자동화 시스템을 우리가 직접 쓰고, 검증된 시스템을 상품으로 판매 |
| **2026 목표** | 우리 학원 자동화 시스템 MVP를 시장에 출시 → 첫 고객 피드백 확보 |
| **총괄책임자** | 클부장 (조직 조정 · 진행상태 점검 · 우선순위 판단 · 대표 보고) |

---

## 조직도

```
                          대표 (원장)
                             │╌╌╌ 🤖 로비서 (대표 직속 · 07:00 브리핑·인사이트)
                             │
                        ┌────┴────┐
                        │  클부장  │  ← 총괄책임자 (COO)
                        └────┬────┘
                             ├╌╌╌ ⑤ 시스템·데이터 인프라 (직속)
                             ├╌╌╌ ⑥ 전략기획실 · 시장·경쟁 인텔 (직속)
                             ├╌╌╌ ⑦ 보안팀 · 보팀장 (직속)
                             │      데이터·정보·안전으로 전 팀을 받친다
        ┌──────────┬──────────┬─────┴────┬──────────┬──────────┐
   ①학원운영팀  ②마케팅팀  ③수익화팀  ④전자책팀  ⑧홈페이지·CS팀
   (운영 자동화)(홍보·판매)(재무·수익)(지식 상품화)(구축·유지보수)
```

정규 팀들은 **병렬**로 움직입니다. 클부장이 팀 간 우선순위와 자원을 조정하고,
막힌 곳을 뚫고, 핵심 상황을 대표에게 보고합니다.
그리고 **⑤ 시스템·데이터 인프라**(클부장 직속)가 4개 팀의 모든 활동을 데이터로 기록해,
자동화·판매·개선의 연료로 만듭니다.
**⑦ 보안팀**(클부장 직속)은 회사·고객 정보와 시스템을 지키되, **수익성과 실행 속도를
최우선**으로 두고 최소한의 마찰로 안전을 겁니다 — 보안은 브레이크가 아니라 안전벨트.

---

## 문서 지도

| 문서 | 내용 |
|------|------|
| [`docs/00_company_charter.md`](docs/00_company_charter.md) | 회사 헌장 — 미션·비전·가치·2026 목표·핵심지표 |
| [`docs/01_org_and_clbujang.md`](docs/01_org_and_clbujang.md) | 조직 구조 & 클부장 운영체계 — 보고체계·우선순위 판단 기준·RACI |
| [`docs/teams/00_team_operating_guidelines.md`](docs/teams/00_team_operating_guidelines.md) | 팀별 업무 운영지침 — 팀장 임명·일하는 방식·보고 규약 |
| [`docs/02_roadmap_2026.md`](docs/02_roadmap_2026.md) | 2026 로드맵 — MVP 출시까지의 단계 |
| [`docs/teams/team1_academy_ops.md`](docs/teams/team1_academy_ops.md) | ① 학원운영팀 |
| [`docs/teams/team2_marketing.md`](docs/teams/team2_marketing.md) | ② 마케팅팀 |
| [`docs/teams/team3_monetization.md`](docs/teams/team3_monetization.md) | ③ 수익화팀 |
| [`docs/teams/team4_ebook.md`](docs/teams/team4_ebook.md) | ④ 전자책·글쓰기팀 |
| [`docs/teams/team5_data_infra.md`](docs/teams/team5_data_infra.md) | ⑤ 시스템·데이터 인프라 (클부장 직속) |
| [`docs/teams/team6_strategy_intel.md`](docs/teams/team6_strategy_intel.md) | ⑥ 전략기획실 · 시장·경쟁 인텔리전스 (클부장 직속) |
| [`docs/teams/team7_security.md`](docs/teams/team7_security.md) | ⑦ 보안팀 · 정보·시스템·법적 안정성 (클부장 직속) |
| [`docs/teams/team8_homepage_cs.md`](docs/teams/team8_homepage_cs.md) | ⑧ 홈페이지 구축·유지보수(CS)팀 (정규 팀) |
| [`docs/playbook/`](docs/playbook/README.md) | 📚 지식 베이스 — 사업 기본기 서적 적용서 (린 스타트업 등) |
| [`docs/templates/weekly_report.md`](docs/templates/weekly_report.md) | 주간 보고 템플릿 (클부장 → 대표) |

---

## 지금 우리가 서 있는 곳

- **현재 단계:** 회사 뼈대 수립 (본 문서 세트)
- **다음 단계:** 4개 팀 중 우선순위 팀의 자동화 MVP 1개를 실제로 구현
- **원칙:** 완벽함은 버린다. 일단 물길을 터서 고객 피드백을 받고, 수익으로 다음 시스템을 산다. (선순환)
