# 쭈1 · 쭈2 관리 홈페이지

아이가 **매일 자기 폰으로 들어와 체크하고, 자기가 해낸 것을 눈으로 보는** 모바일 웹앱입니다.

> 이 앱의 목적은 감시가 아니라 **보이게 만드는 것**입니다.
> 아이는 자기가 뭘 했는지 보이지 않으면 자기를 믿을 근거가 없습니다.

기획서 전문: Notion `🖥️ 쭈1·쭈2 관리 홈페이지 기획서 v1.0`

---

## 설계에서 절대 바꾸지 말아야 할 8가지

이건 취향이 아니라 9월에 한 번 실패하고 얻은 규칙입니다.

| # | 규칙 | 코드에서 어디에 |
| --- | --- | --- |
| 1 | 첫 화면은 '할 일'이 아니라 **승리 장부** | `app/(child)/page.tsx` |
| 2 | 하루 입력 60초 이내 | 항목 수를 늘릴 때마다 이 기준으로 판단 |
| 3 | 🔴고정 / 🟡선택 / 🟢자유 3단 구조 | `task_defs.kind` |
| 4 | 8살·10살 화면 분리 | `users.ui_size` (`md` / `lg`) |
| 5 | **못 한 날을 벌하지 않는다** — 빨간 X 없음, 빈칸, 연속 기록 0 리셋 안 함 | `lib/queries.ts` `progressFor()` |
| 6 | 부모 화면 1번 기능은 **3일 미입력 경보** | `lib/queries.ts` `alertsFor()` |
| 7 | 형제를 나란히 놓는 비교 UI는 만들지 않는다 | 부모 화면도 세로로 분리 |
| 8 | **체중은 부모 화면에만** | `task_defs.parent_only` |

추가로, 운동은 **자기 체중만 / 하루 10분 이내 / 거리 측정 없음**입니다.
1.5 km 달리기는 의도적으로 넣지 않았습니다(PAPS 초3~4 기준은 1,000 m).
아이가 먼저 하겠다고 할 때 넣으십시오.

---

## 대표님이 하실 일 (배포)

### 1. Vercel에 저장소 연결
[vercel.com](https://vercel.com) → **Add New → Project** → 이 저장소 선택 →
Framework는 자동으로 Next.js로 잡힙니다 → **Deploy**.

### 2. Postgres 만들기
Vercel 프로젝트 → **Storage → Create Database → Postgres(Neon)** → Connect.
`POSTGRES_URL` 환경변수가 자동으로 들어갑니다.

### 3. 로그인 비밀 키 넣기
Settings → Environment Variables 에 하나 추가합니다.

| Key | Value |
| --- | --- |
| `AUTH_SECRET` | 32자 이상의 아무 긴 문자열 |

만드는 법 (아무 터미널에서):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

넣은 뒤 **Redeploy** 를 한 번 눌러야 적용됩니다.

### 4. 스키마와 초기 데이터 넣기 (딱 한 번)

Vercel의 DB 연결 문자열을 복사해서, 로컬에서 한 번만 실행합니다.

```bash
git clone <이 저장소> && cd product-builder-test
npm install
echo 'POSTGRES_URL=여기에_Vercel_연결문자열' > .env.local
echo 'AUTH_SECRET=여기에_위에서_만든_키'   >> .env.local

npm run db:push    # 테이블 생성
npm run db:seed    # 68개 체크 항목 · 요일별 운동 · 승리 장부 초기값
```

### 5. 비밀번호 바꾸기 ⚠️

초기 PIN은 **쭈1 1001 / 쭈2 1002 / 아빠 2001 / 엄마 2002** 입니다.
배포 직후 부모로 로그인 → **항목 → 🔑 비밀번호 바꾸기** 에서 네 사람 모두 바꾸십시오.

### 6. 아이 폰에 설치
아이 폰 브라우저로 주소 접속 →
- **iPhone(Safari)**: 공유 버튼 → `홈 화면에 추가`
- **Android(Chrome)**: 메뉴 → `앱 설치` 또는 `홈 화면에 추가`

주소창 없는 앱처럼 열립니다.

---

## 화면

### 아이 (6개 탭)

| 탭 | 하는 일 |
| --- | --- |
| 🏆 승리 | **첫 화면.** 내가 이미 해낸 것 + 기록한 날 / 이어가는 날 |
| ✅ 오늘 | 체크. 잠·몸 → 생활 → 운동 → 공부 → 선택 → 사람·안전 → 마음 순서. 최근 7일은 거슬러 입력 가능 |
| 💪 운동 | 오늘 요일 메뉴가 자동으로 뜸. "오늘은 쉴게" 버튼 있음 |
| 📚 공부 | 오늘 할 공부 + 과목별 진도 (8과목) |
| 📖 기록 | 읽은 책 / 용돈 / 다친 곳 |
| 📊 나 | 최근 2주 **지속률만**. 점수·체중은 안 보임 |

### 부모 (3개 탭)

| 탭 | 하는 일 |
| --- | --- |
| 🚨 경보 | 3일 미입력 · 수면 부족 · 운동 0일 · 간식 초과 · 기분 저하 |
| 📋 항목 | 68개 항목 on/off, 새 항목 추가, PIN 변경 |
| 📝 메모 | 관찰 메모(아이에게 안 보임) · 승리 장부에 하나 추가 |

`/parent/[아이]` 에서 최근 2주 추이, **체중·키 입력**, 다친 시간대 집계를 봅니다.

---

## 항목 추가하는 법

화면을 고치지 않아도 됩니다. **부모 → 항목 → ➕ 항목 추가** 한 번이면 끝입니다.
(`task_defs` 테이블에 행 하나가 추가되고 아이 화면이 따라옵니다)

단, **한 번에 많이 켜지 마십시오.** 하루 입력이 1분을 넘으면 아이는 포기합니다.

---

## 처음 4주 규칙 — 이게 제일 중요합니다

9월 설계가 무너진 이유는 기능이 부족해서가 아니라, **아이 혼자 하게 뒀기** 때문입니다.

- 처음 4주는 **밤에 어른이 옆에 앉아서 같이 2~3분** 채웁니다.
- 아이가 혼자 하도록 넘기는 것은 **4주 뒤**입니다.
- 3일 비면 앱이 경보를 띄웁니다. 그때는 아이를 혼내는 게 아니라 **같이 앉는 날**입니다.

---

## 보안 — 솔직한 한계

가족 전용이지만 **공개 URL**이고, 아이 건강·정서 데이터입니다.

지금 들어가 있는 것:
- PIN 4자리 + **5회 틀리면 10분 잠금** (DB 카운터)
- httpOnly · secure · sameSite=lax 로 서명된 세션 쿠키(90일)
- `robots.txt` 전면 차단 + 모든 응답에 `X-Robots-Tag: noindex`
- `/parent/*` 는 부모 역할만 통과 (미들웨어)
- 외부 공유 링크 기능 없음

**한계:** PIN 4자리는 약합니다. 지금 설계는 "가족 4명 + 추측하기 어려운 URL" 전제입니다.
더 필요하면 Vercel 유료의 Password Protection 또는 실제 계정 인증이 필요합니다.
**주소를 외부에 공유하지 마십시오.**

---

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm run test       # 날짜·PIN 단위 테스트 (16개)
npm run typecheck
npm run build
npm run db:reset   # 테이블 전체 삭제 후 재생성 + 시드 (주의)
```

로컬 Postgres 예시:

```bash
service postgresql start
psql -U postgres -c "CREATE ROLE juju LOGIN PASSWORD 'devpass' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE juju OWNER juju;"
echo 'POSTGRES_URL=postgres://juju:devpass@127.0.0.1:5432/juju' > .env.local
echo 'AUTH_SECRET=dev-only-secret-change-me-32-characters-long' >> .env.local
```

### 날짜는 전부 KST

Vercel 런타임은 UTC입니다. `new Date()` 를 그대로 쓰면 **한국 시각 0시~9시 사이 입력이
"어제"로 기록됩니다.** 그래서 모든 날짜 계산은 `lib/date.ts` 만 거칩니다.
`test/date.test.ts` 가 UTC 00:00 / 14:59 / 15:00 경계를 지키고 있습니다.

`daysBetween(a, b)` 는 **a − b** 입니다. 뒤 날짜를 앞에 두십시오.

### 구조

```
lib/date.ts       KST 날짜 계산 (여기만 거친다)
lib/db.ts         Postgres 풀 + sql 태그드 템플릿
lib/pin.ts        scrypt PIN 해시
lib/auth.ts       세션 쿠키 · 로그인 · 5회 잠금
lib/queries.ts    모든 조회·집계 (경보 판정 포함)
db/schema.sql     테이블 12개
db/seed.ts        ★ 체크 항목 전부가 여기 있다
app/(child)/      아이 화면 6개
app/parent/       부모 화면
middleware.ts     인증 · 역할 게이트 (Edge, pg 사용 불가)
```
