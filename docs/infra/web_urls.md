# 🌐 도현컴퍼니 웹페이지 URL 모음 (실시간 확인용)

> 우리가 구축한 모든 웹페이지를 한 곳에 모아 **중간중간 바로 접속·확인**하기 위한 목록.
> 관리: ⑧ 홈페이지·CS팀 · 노션 미러: 「🌐 도현컴퍼니 웹페이지 URL 모음」(⑧ 팀 하위).
> **새 웹페이지를 배포하면 ⑧ 홈팀장이 이 표에 한 줄 추가**(⑤ 데이터 거버넌스: 레지스트리 등록 의무).
> 최종 확인: 2026-09-11 (① ② 전부 200 OK).

---

## ① 실서비스 (Netlify · 누구나 접속)
| 이름 | URL | 비고 |
|---|---|---|
| 🏠 홈페이지 (회사 소개·B2B 랜딩) | https://dohyeon-piano.netlify.app/ | 공개 |
| 🎵 리듬·박자 연습기 | https://dohyeon-piano.netlify.app/rhythm/ | 공개 도구 |

## ② 운영 대시보드 (관리자용 · `DASHBOARD_PIN` 설정 시 잠금)
| 메뉴 | URL |
|---|---|
| 📊 대시보드 홈 | https://dohyeon-piano.netlify.app/dashboard |
| 원생 관리 | https://dohyeon-piano.netlify.app/dashboard/customers |
| 할일 관리 | https://dohyeon-piano.netlify.app/dashboard/tasks |
| 일정 관리 | https://dohyeon-piano.netlify.app/dashboard/schedules |
| 자료실 | https://dohyeon-piano.netlify.app/dashboard/resource-library |
| 매출 관리 | https://dohyeon-piano.netlify.app/dashboard/revenues |
| 입금 관리 | https://dohyeon-piano.netlify.app/dashboard/deposits |
| 로그 관리 | https://dohyeon-piano.netlify.app/dashboard/logs |
| 토큰 사용량 | https://dohyeon-piano.netlify.app/dashboard/usage |
| 등록 관리 | https://dohyeon-piano.netlify.app/dashboard/contracts |
| 직원 관리 | https://dohyeon-piano.netlify.app/dashboard/employees |
| 시스템 설정(백업) | https://dohyeon-piano.netlify.app/dashboard/settings |
| 관리자(마이) | https://dohyeon-piano.netlify.app/dashboard/my |

## ③ 내부 도구 (claude.ai 아티팩트 · 로그인 필요)
| 이름 | URL |
|---|---|
| 🏢 도현컴퍼니 사업회의(회의 도구) | https://claude.ai/code/artifact/dcecbfcf-b7e2-44c3-92cc-e0d68b33d6cf |
| 🎁 상담 후속 소개 인포그래픽 카드 | https://claude.ai/code/artifact/ef128f4d-e9cd-4282-bcbe-e987d8e42736 |

---

*정적 파일 경로(`/rhythm/`, `/logo-mark.png` 등)는 SPA 라우팅보다 먼저 서빙됨. 배포: dohyeon-piano(master) → Netlify 자동.*
