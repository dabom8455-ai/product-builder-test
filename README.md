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
| **총괄책임자** | 클부장 (COO · 실행 총괄 · 대표 보고) / 전실장 (CSO · 전략 총괄, 클부장과 동급) |
| **경영 도구** | [팀 현황 대시보드](https://claude.ai/code/artifact/965c4765-d888-4a43-9e00-24470fb06ee2) · [조직 마인드맵](https://claude.ai/code/artifact/90461800-ead3-4acd-ad14-0311d2c63996) |

---

## 조직도

```
                                  대표 (원장)  ╌╌╌ 🤖 로비서 (대표 직속)
                    ┌──────────────────┴──────────────────┐
               ┌────┴────┐                          ┌──────┴──────┐
               │  클부장  │ COO · 실행 총괄            │   전실장    │ CSO · 전략 총괄
               └────┬────┘                          └──────┬──────┘   (클부장과 동급)
                    ├╌ ⑤ 시스템·데이터 인프라 (직속)          ├── A팀 (전략 수립·인텔)
                    ├╌ ⑦ 보안팀 (직속)                      └── B팀 (비판 검토·레드팀)
                    │
   ┌──────────┬─────┴────┬────────────┬──────────────┐
 ①학원운영   ②마케팅   ③재무회계세무  ④지식·콘텐츠   ⑧홈페이지·CS
 (운영 자동화)(홍보·판매)(재무·회계·세무)(콘텐츠 수익화)(구축·유지보수)
```
> ② 마케팅팀은 **채널별 4담당**(블대리 블로그 · 유대리 유튜브/쇼츠 · 릴대리 릴스/스레드 · 쥐대리 GEO)으로 편성.
> ③ 팀은 회사 **회계·세무**를 책임(재팀장). ④ 팀은 전자책 단독이 아닌 **시스템 판매용 콘텐츠**(리드마그넷·템플릿)로 재정의.

회사는 대표 아래 **두 축**으로 굴러갑니다 — **클부장(COO·실행)** 과 **전실장(CSO·전략)**, 동급으로 서로 견제·보완.
정규 팀(①②③④⑧)은 **병렬**로 움직이고, 클부장이 우선순위·자원을 조정하며 **⑤ 인프라·⑦ 보안**(직속)이 이들을 받칩니다.
**전략기획실**(대표 직속·전실장)은 전 부서 업무를 점검해 **대표께 직언**하고, 회사 **수익 전략을 책임**집니다 —
**A팀**이 전략을 세우면 **B팀**이 비판적으로 검토(레드팀)하고, 전실장이 최적안을 골라 대표께 상신합니다.
**대표가 재가한 전략은 전 부서가 의무적으로 반영**합니다. (구 '왕궁 어전회의'는 폐지 → 본 전략기획실로 대체.)

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
| [`docs/teams/team3_monetization.md`](docs/teams/team3_monetization.md) | ③ 재무회계세무팀 (재팀장 · 재무·회계·세무) |
| [`docs/teams/team4_ebook.md`](docs/teams/team4_ebook.md) | ④ 지식·콘텐츠 수익화팀 (리드마그넷·템플릿·전자책) |
| [`docs/teams/team5_data_infra.md`](docs/teams/team5_data_infra.md) | ⑤ 시스템·데이터 인프라 (클부장 직속) |
| [`docs/teams/team6_strategy_intel.md`](docs/teams/team6_strategy_intel.md) | 전략기획실 · 대표 직속 (전실장 · A팀/B팀 · 수익 전략) |
| [`docs/teams/team7_security.md`](docs/teams/team7_security.md) | ⑦ 보안팀 · 정보·시스템·법적 안정성 (클부장 직속) |
| [`docs/teams/team8_homepage_cs.md`](docs/teams/team8_homepage_cs.md) | ⑧ 홈페이지 구축·유지보수(CS)팀 (정규 팀) |
| [`docs/teams/strategy/`](docs/teams/strategy/) | 전략 브리프 #001~#004 (수익화·북극성·GTM·운영확장) — 대표 승인 |
| [`docs/finance/accounting_plan.md`](docs/finance/accounting_plan.md) | 재무상태 정립 & 회계 관리 계획 (2부문 회계·월마감·세무) |
| [`docs/infra/data_registry.md`](docs/infra/data_registry.md) | 데이터 레지스트리 — 노션 DB 전수(원생·상담·판매 CRM 등) |
| [`docs/infra/web_urls.md`](docs/infra/web_urls.md) | 웹페이지 URL 모음 (홈페이지·대시보드·아티팩트) |
| [`docs/playbook/`](docs/playbook/README.md) | 📚 지식 베이스 — 사업 기본기 서적 적용서 (린 스타트업 등) |
| [`docs/templates/weekly_report.md`](docs/templates/weekly_report.md) | 주간 보고 템플릿 (클부장 → 대표) |

---

## 지금 우리가 서 있는 곳

- **현재 단계:** 첫 수익화 물길 — 리드마그넷 → 트립와이어(9,900원) → 컨시어지 셋업(39만) 착수
- **다음 단계:** 정규 팀 중 우선순위 팀의 자동화 MVP를 실제 매출로 검증 (견인 우선)
- **원칙:** 완벽함은 버린다. 일단 물길을 터서 고객 피드백을 받고, 수익으로 다음 시스템을 산다. (선순환)
