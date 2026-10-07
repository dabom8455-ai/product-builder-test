/**
 * 기획서 §4 전 항목을 DB에 넣는다. 이 프로젝트에서 가장 중요한 파일.
 * 항목을 추가하려면 아래 TASKS 배열에 한 줄 넣고 `npm run db:seed` 를 다시 돌린다.
 * (task_key 기준 UPSERT 이므로 여러 번 실행해도 안전하다)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { raw, sql, sqlOne, closePool } from "../lib/db.ts";
import { hashPin } from "../lib/pin.ts";
import { todayKST } from "../lib/date.ts";

type Who = "both" | "juju1" | "juju2";
type Kind = "fixed" | "choice" | "free";
type ValueType = "bool" | "num" | "text" | "time" | "mood";
type Category =
  | "health" | "life" | "study" | "exercise"
  | "mind" | "relation" | "money" | "safety";

type TaskDef = {
  who: Who;
  key: string;
  label: string;
  emoji?: string;
  category: Category;
  kind: Kind;
  type: ValueType;
  target?: number;
  unit?: string;
  weekdays?: number[];      // 생략 = 매일. 1=월 … 7=일
  group?: string;           // choice 그룹
  hint?: string;
  phase?: number;
  parentOnly?: boolean;
  active?: boolean;
  label2?: string;          // 쭈2용 다른 문구 (who='both' 일 때)
  hint2?: string;           // 쭈2용 다른 힌트
  target2?: number;         // 쭈2용 다른 목표치
};

/* ============================================================
   🔴 매일 고정 — 생활·건강의 바닥. 이건 선택이 아니다.
   ============================================================ */
const FIXED: TaskDef[] = [
  { who: "both", key: "sleep_at", label: "잠든 시각", emoji: "🌙", category: "life", kind: "fixed", type: "time",
    hint: "밤 9시 30분까지", hint2: "밤 9시까지", phase: 1 },
  { who: "both", key: "wake_at", label: "일어난 시각", emoji: "☀️", category: "life", kind: "fixed", type: "time",
    hint: "07:00 목표", phase: 1 },
  { who: "both", key: "breakfast", label: "아침 먹었다", emoji: "🍳", category: "health", kind: "fixed", type: "bool",
    hint: "단백질 하나는 꼭 (계란·두유·우유·치즈)", phase: 1 },
  { who: "both", key: "veggie", label: "채소나 과일 먹었다", emoji: "🥕", category: "health", kind: "fixed", type: "bool", phase: 1 },
  { who: "both", key: "water", label: "물 마신 컵", emoji: "💧", category: "health", kind: "fixed", type: "num",
    target: 6, target2: 5, unit: "컵", phase: 1 },
  { who: "both", key: "snack_count", label: "과자·단 것 먹은 횟수", emoji: "🍪", category: "health", kind: "fixed", type: "num",
    target: 1, unit: "번", hint: "하루 1번까지. 0번이면 승리", phase: 1 },
  { who: "both", key: "screen_min", label: "핸드폰·TV 본 시간", emoji: "📱", category: "health", kind: "fixed", type: "num",
    target: 60, target2: 40, unit: "분", hint: "숙제·공부용 화면은 안 센다", phase: 1 },
  { who: "both", key: "brush_teeth", label: "양치 2번 했다", emoji: "🪥", category: "health", kind: "fixed", type: "bool", phase: 1 },
  { who: "both", key: "bag_check", label: "내일 가방 챙겼다", emoji: "🎒", category: "life", kind: "fixed", type: "bool",
    label2: "내일 가방 챙겼다", hint: "시간표 보고 하나씩", phase: 1 },
  { who: "both", key: "tidy_things", label: "내 물건 제자리에 뒀다", emoji: "🧺", category: "life", kind: "fixed", type: "bool",
    hint: "놓고 온 물건 없는지 한 번 더", phase: 1 },
  { who: "both", key: "poop", label: "응가 했다", emoji: "🚽", category: "health", kind: "fixed", type: "bool", phase: 1 },
  { who: "both", key: "exercise_done", label: "오늘 운동 했다 (10분)", emoji: "💪", category: "exercise", kind: "fixed", type: "bool",
    hint: "운동 탭에 오늘 메뉴가 떠 있다", phase: 1 },
];

/* ============================================================
   📚 학습 — 쭈2도 전 과목. 분량만 초1 수준.
   ============================================================ */
const STUDY: TaskDef[] = [
  { who: "juju1", key: "math", label: "수학 — 외삼촌 커리큘럼 20분", emoji: "🔢", category: "study", kind: "fixed", type: "bool", phase: 1 },
  { who: "juju2", key: "math", label: "수학 — 외삼촌 수 감각 9분", emoji: "🔢", category: "study", kind: "fixed", type: "bool", phase: 1 },

  { who: "both", key: "read_aloud", label: "국어 — 소리내어 읽기 10분", emoji: "📖", category: "study", kind: "fixed", type: "bool",
    hint: "입으로 소리내서. 눈으로만 읽는 건 안 센다", phase: 1 },

  { who: "juju1", key: "english_hw", label: "영어 — YBM 숙제", emoji: "🔤", category: "study", kind: "fixed", type: "bool", phase: 1 },
  { who: "juju2", key: "english_hw", label: "영어 — 비투비 숙제", emoji: "🔤", category: "study", kind: "fixed", type: "bool", phase: 1 },
  { who: "juju2", key: "english_fun", label: "영어 노래·영상 하나", emoji: "🎵", category: "study", kind: "fixed", type: "bool",
    hint: "좋아하는 거니까 부담 없이", phase: 1 },

  { who: "juju1", key: "hanja", label: "한자 2자", emoji: "✍️", category: "study", kind: "fixed", type: "bool", phase: 2 },
  { who: "juju2", key: "hanja", label: "한자 1자", emoji: "✍️", category: "study", kind: "fixed", type: "bool", phase: 2 },

  { who: "juju2", key: "finger_rule", label: "👆 손가락 규칙 지켰다", emoji: "👆", category: "study", kind: "fixed", type: "bool",
    hint: "① 문제를 손가락으로 짚고 ② 소리내어 읽고 ③ \"뭐를 구하래?\" 말하기", phase: 1 },

  { who: "juju1", key: "social", label: "사회 — 우리 고장(용인·처인구) 알아보기", emoji: "🗺️", category: "study", kind: "fixed", type: "bool",
    weekdays: [6], phase: 2 },
  { who: "juju2", key: "social", label: "사회 — 우리 동네·가족·학교 이야기", emoji: "🗺️", category: "study", kind: "fixed", type: "bool",
    weekdays: [6], phase: 2 },

  { who: "juju1", key: "science", label: "과학 — 주방 실험 하나", emoji: "🔬", category: "study", kind: "fixed", type: "bool",
    weekdays: [3, 6], phase: 2 },
  { who: "juju2", key: "science", label: "과학 — 오늘 관찰한 것 1개", emoji: "🔬", category: "study", kind: "fixed", type: "bool",
    weekdays: [3, 6], phase: 2 },

  { who: "juju1", key: "econ", label: "경제 — 주급 받고 3개 통에 나누기", emoji: "💰", category: "money", kind: "fixed", type: "bool",
    weekdays: [7], hint: "쓸 돈 / 모을 돈 / 나눌 돈", phase: 2 },
  { who: "juju2", key: "econ", label: "경제 — 동전 세고 용돈 적기", emoji: "💰", category: "money", kind: "fixed", type: "bool",
    weekdays: [7], phase: 2 },

  { who: "both", key: "ai_study", label: "AI 배우기", emoji: "🤖", category: "study", kind: "fixed", type: "bool",
    hint: "타자가 익숙해지면 열린다", phase: 3, active: false },
];

/* ============================================================
   🟡 오늘의 선택 — 셋 중 하나만. 고르는 연습이 목적이다.
   ============================================================ */
const CHOICE: TaskDef[] = [
  { who: "juju1", key: "pick_typing", label: "타자 연습 10분", emoji: "⌨️", category: "study", kind: "choice", type: "bool", group: "today_pick", phase: 1 },
  { who: "juju1", key: "pick_writing", label: "일기나 주제글 쓰기", emoji: "📝", category: "study", kind: "choice", type: "bool", group: "today_pick", phase: 1 },
  { who: "juju1", key: "pick_reading", label: "읽고 싶은 책 읽기", emoji: "📚", category: "study", kind: "choice", type: "bool", group: "today_pick", phase: 1 },
  { who: "juju1", key: "pick_lego", label: "레고·그림 몰입", emoji: "🧱", category: "mind", kind: "choice", type: "bool", group: "today_pick",
    hint: "이것도 당당한 선택이다", phase: 1 },

  { who: "juju2", key: "pick_drawing", label: "그림 그리기", emoji: "🎨", category: "mind", kind: "choice", type: "bool", group: "today_pick", phase: 1 },
  { who: "juju2", key: "pick_making", label: "만들기", emoji: "✂️", category: "mind", kind: "choice", type: "bool", group: "today_pick", phase: 1 },
  { who: "juju2", key: "pick_reading", label: "읽고 싶은 책 읽기", emoji: "📚", category: "study", kind: "choice", type: "bool", group: "today_pick", phase: 1 },
  { who: "juju2", key: "pick_typing", label: "한글 자판 연습 5분", emoji: "⌨️", category: "study", kind: "choice", type: "bool", group: "today_pick", phase: 1 },
];

/* ============================================================
   🧠 정서 · 👬 관계 · 🛡 안전 · 💚 주1 건강
   ============================================================ */
const OTHERS: TaskDef[] = [
  { who: "both", key: "mood", label: "오늘 내 기분", emoji: "🙂", category: "mind", kind: "fixed", type: "mood", phase: 1 },
  { who: "both", key: "grateful", label: "고마운 것 하나", emoji: "💛", category: "mind", kind: "free", type: "text", phase: 2 },
  { who: "both", key: "fail_today", label: "오늘 잘 안 된 것", emoji: "🌱", category: "mind", kind: "free", type: "text",
    hint: "적는 것 자체가 승리다. 혼나는 칸이 아니다", phase: 2 },

  { who: "juju1", key: "brought_brother", label: "동생 돌봄에서 데려왔다", emoji: "👬", category: "relation", kind: "fixed", type: "bool",
    weekdays: [1, 2, 3, 4, 5], hint: "아빠가 꼭 \"고마워\" 하는 항목", phase: 1 },
  { who: "juju2", key: "thanks_brother", label: "형에게 고맙다고 말했다", emoji: "👬", category: "relation", kind: "fixed", type: "bool",
    weekdays: [1, 2, 3, 4, 5], phase: 1 },
  { who: "both", key: "call_dad", label: "아빠랑 통화했다", emoji: "📞", category: "relation", kind: "fixed", type: "bool", phase: 2 },

  { who: "both", key: "helmet", label: "자전거 탈 때 헬멧 썼다", emoji: "🪖", category: "safety", kind: "fixed", type: "bool",
    hint: "자전거 안 탄 날은 비워두면 된다", phase: 2 },

  { who: "both", key: "weight", label: "체중", emoji: "⚖️", category: "health", kind: "fixed", type: "num",
    unit: "kg", weekdays: [7], parentOnly: true, hint: "아이 화면에는 숫자가 보이지 않는다", phase: 1 },
  { who: "both", key: "height", label: "키", emoji: "📏", category: "health", kind: "fixed", type: "num",
    unit: "cm", weekdays: [7], parentOnly: true, phase: 2 },
  { who: "both", key: "eye_check", label: "눈 쉬게 하기 · 시력 확인", emoji: "👀", category: "health", kind: "fixed", type: "bool",
    weekdays: [7], hint: "먼 산 20초 보기. 6개월마다 안과", phase: 3 },
];

const ALL_TASKS = [...FIXED, ...STUDY, ...CHOICE, ...OTHERS];

/* ============================================================
   💪 요일별 운동 — 자기 체중만. 하루 10분 이내. 거리 측정 없음.
   ============================================================ */
type Ex = { wd: number; theme: string; name: string; rx1: string; rx2: string };
const EXERCISE: Ex[] = [
  { wd: 1, theme: "하체", name: "의자 스쿼트", rx1: "10회 × 2세트", rx2: "6회 × 2세트" },
  { wd: 1, theme: "하체", name: "제자리 런지", rx1: "양쪽 6회", rx2: "양쪽 4회" },
  { wd: 1, theme: "하체", name: "까치발 들기", rx1: "15회", rx2: "10회" },

  { wd: 2, theme: "코어", name: "플랭크", rx1: "20초 × 2", rx2: "12초 × 2" },
  { wd: 2, theme: "코어", name: "누워 다리 들기", rx1: "10회", rx2: "6회" },
  { wd: 2, theme: "코어", name: "데드버그", rx1: "양쪽 8회", rx2: "양쪽 5회" },

  { wd: 3, theme: "상체", name: "무릎 푸시업", rx1: "8회 × 2", rx2: "5회 × 2" },
  { wd: 3, theme: "상체", name: "벽 푸시업", rx1: "12회", rx2: "8회" },
  { wd: 3, theme: "상체", name: "매달리기", rx1: "10초 × 2", rx2: "6초 × 2" },

  { wd: 4, theme: "유연·균형", name: "앉아 앞으로 숙이기", rx1: "20초 × 2", rx2: "15초 × 2" },
  { wd: 4, theme: "유연·균형", name: "한 발 서기", rx1: "양발 20초", rx2: "양발 12초" },
  { wd: 4, theme: "유연·균형", name: "고양이-소 자세", rx1: "10회", rx2: "8회" },

  { wd: 5, theme: "줄넘기", name: "줄넘기", rx1: "30회 × 3", rx2: "15회 × 3", },
  { wd: 5, theme: "줄넘기", name: "두 발 모아 점프", rx1: "20회", rx2: "12회" },

  { wd: 6, theme: "아빠와 함께", name: "아빠랑 걷기·뛰기", rx1: "10분 (거리 안 잼)", rx2: "8분 (거리 안 잼)" },
  { wd: 6, theme: "아빠와 함께", name: "아빠랑 공놀이·자전거", rx1: "자유", rx2: "자유" },

  { wd: 7, theme: "자유", name: "하고 싶은 몸놀이", rx1: "10분", rx2: "10분" },
  { wd: 7, theme: "자유", name: "쉬어도 된다", rx1: "쉼도 운동 계획의 일부", rx2: "쉼도 운동 계획의 일부" },
];

/* ============================================================
   🏆 승리 장부 초기값 — 첫 화면에 들어갈 "이미 해낸 것"
   ============================================================ */
const WINS: Record<"juju1" | "juju2", { title: string; hard: string; now: string }[]> = {
  juju1: [
    { title: "체스로 친구를 이겼다", hard: "친구들한테 계속 졌다", now: "혼자 연습해서 이겼다" },
    { title: "영어학원 YBM TOP3", hard: "영어가 처음엔 낯설었다", now: "학원에서 상위 3등" },
    { title: "주제글쓰기 상 받았다", hard: "글 쓰는 게 막막했다", now: "상장을 받았다" },
    { title: "반 부회장이 됐다", hard: "앞에 나서는 게 어색했다", now: "반 친구들이 뽑아줬다" },
    { title: "선생님을 도와드렸다", hard: "", now: "먼저 나서서 도왔다" },
    { title: "매일 1분도 안 늦었다", hard: "", now: "지각 안 하는 건 내 자부심" },
    { title: "레고를 3시간 붙잡았다", hard: "", now: "끝까지 앉아서 완성했다" },
    { title: "동생을 매일 데려온다", hard: "", now: "월~금 하루도 안 빼먹었다" },
  ],
  juju2: [
    { title: "줄넘기를 할 수 있게 됐다", hard: "10개도 못 넘었다", now: "이제 잘 넘는다" },
    { title: "영어를 혼자 공부한다", hard: "", now: "시키지 않아도 찾아서 한다" },
    { title: "글씨를 또박또박 쓴다", hard: "", now: "글씨 잘 쓴다고 칭찬받았다" },
    { title: "정리를 잘한다", hard: "", now: "내 물건은 내가 제자리에 둔다" },
    { title: "불닭김 때문에 놀림받았지만 말했다", hard: "속상해서 숨길 수도 있었다", now: "아빠한테 솔직히 말했다" },
  ],
};

/* ============================================================
   📚 과목 진도 초기값
   ============================================================ */
const SUBJECTS: Record<"juju1" | "juju2", { subject: string; unit: string; owner: string }[]> = {
  juju1: [
    { subject: "수학", unit: "3학년 1학기 — 외삼촌 커리큘럼 시작", owner: "외삼촌" },
    { subject: "영어", unit: "YBM 현재 레벨 숙제", owner: "학원" },
    { subject: "국어", unit: "소리내어 읽기 — 교과서/동화", owner: "엄마" },
    { subject: "한자", unit: "8급 시작 (하루 2자)", owner: "엄마" },
    { subject: "사회", unit: "우리 고장 용인·처인구 모현읍", owner: "아빠" },
    { subject: "과학", unit: "주방에서 하는 실험 1번", owner: "아빠" },
    { subject: "경제", unit: "주급제 · 3개 통 나누기", owner: "아빠" },
    { subject: "타자", unit: "한글 자리 익히기", owner: "본인" },
  ],
  juju2: [
    { subject: "수학", unit: "1학년 — 외삼촌 수 감각 9분", owner: "외삼촌" },
    { subject: "영어", unit: "비투비 숙제 + 영어 노래", owner: "학원" },
    { subject: "국어", unit: "소리내어 읽기 · 받아쓰기", owner: "엄마" },
    { subject: "한자", unit: "하루 1자", owner: "엄마" },
    { subject: "사회", unit: "우리 동네·가족·학교", owner: "아빠" },
    { subject: "과학", unit: "오늘 관찰한 것 1개", owner: "아빠" },
    { subject: "경제", unit: "동전 세기 · 용돈 기록", owner: "아빠" },
    { subject: "타자", unit: "한글 자판 눌러보기", owner: "본인" },
  ],
};

/* ============================================================ */

const USERS = [
  { slug: "juju1", name: "쭈1", role: "child", pin: "1001", birth: 2016, grade: "초3", age: "초3", color: "blue",  emoji: "🧒", size: "md", order: 1 },
  { slug: "juju2", name: "쭈2", role: "child", pin: "1002", birth: 2018, grade: "초1", age: "초1", color: "green", emoji: "🧑", size: "lg", order: 2 },
  { slug: "dad",   name: "아빠", role: "parent", pin: "2001", birth: null, grade: null, age: null, color: "slate", emoji: "👨", size: "md", order: 3 },
  { slug: "mom",   name: "엄마", role: "parent", pin: "2002", birth: null, grade: null, age: null, color: "rose",  emoji: "👩", size: "md", order: 4 },
] as const;

async function main() {
  const ids: Record<string, number> = {};

  for (const u of USERS) {
    const row = await sqlOne<{ id: number }>`
      INSERT INTO users (slug, display_name, role, pin_hash, birth_year, grade_label,
                         age_group, theme_color, emoji, ui_size, sort_order)
      VALUES (${u.slug}, ${u.name}, ${u.role}, ${hashPin(u.pin)}, ${u.birth}, ${u.grade},
              ${u.age}, ${u.color}, ${u.emoji}, ${u.size}, ${u.order})
      ON CONFLICT (slug) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            role         = EXCLUDED.role,
            grade_label  = EXCLUDED.grade_label,
            age_group    = EXCLUDED.age_group,
            theme_color  = EXCLUDED.theme_color,
            emoji        = EXCLUDED.emoji,
            ui_size      = EXCLUDED.ui_size,
            sort_order   = EXCLUDED.sort_order
      RETURNING id`;
    ids[u.slug] = row!.id;
  }
  console.log(`👤 사용자 ${USERS.length}명`);

  // ---- task_defs ----
  let order = 0;
  let taskCount = 0;
  for (const t of ALL_TASKS) {
    const targets: ("juju1" | "juju2")[] =
      t.who === "both" ? ["juju1", "juju2"] : [t.who];
    order += 10;
    for (const slug of targets) {
      const label = slug === "juju2" && t.label2 ? t.label2 : t.label;
      const target = slug === "juju2" && t.target2 !== undefined ? t.target2 : t.target;
      const hint = slug === "juju2" && t.hint2 ? t.hint2 : t.hint;
      await raw(
        `INSERT INTO task_defs (child_id, task_key, label, emoji, category, kind, value_type,
                                target_num, unit, weekdays, choice_group, hint, phase,
                                parent_only, is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (child_id, task_key) DO UPDATE
           SET label=EXCLUDED.label, emoji=EXCLUDED.emoji, category=EXCLUDED.category,
               kind=EXCLUDED.kind, value_type=EXCLUDED.value_type,
               target_num=EXCLUDED.target_num, unit=EXCLUDED.unit,
               weekdays=EXCLUDED.weekdays, choice_group=EXCLUDED.choice_group,
               hint=EXCLUDED.hint, phase=EXCLUDED.phase,
               parent_only=EXCLUDED.parent_only, is_active=EXCLUDED.is_active,
               sort_order=EXCLUDED.sort_order`,
        [ids[slug], t.key, label, t.emoji ?? "", t.category, t.kind, t.type,
         target ?? null, t.unit ?? null, t.weekdays ?? null, t.group ?? null,
         hint ?? null, t.phase ?? 1, t.parentOnly ?? false, t.active ?? true, order]
      );
      taskCount++;
    }
  }
  console.log(`✅ 체크 항목 ${taskCount}개 (쭈1·쭈2 합계)`);

  // ---- 운동 ----
  await raw(`DELETE FROM exercise_plan`);
  let exOrder = 0;
  for (const e of EXERCISE) {
    exOrder += 10;
    await raw(
      `INSERT INTO exercise_plan (weekday, age_group, theme, name, prescription, sort_order)
       VALUES ($1,'초3',$2,$3,$4,$5), ($1,'초1',$2,$3,$6,$5)`,
      [e.wd, e.theme, e.name, e.rx1, exOrder, e.rx2]
    );
  }
  console.log(`💪 운동 처방 ${EXERCISE.length * 2}개 (초3·초1)`);

  // ---- 승리 장부 ----
  const today = todayKST();
  let winCount = 0;
  for (const slug of ["juju1", "juju2"] as const) {
    await raw(`DELETE FROM wins WHERE child_id = $1`, [ids[slug]]);
    let wOrder = 0;
    for (const w of WINS[slug]) {
      wOrder += 10;
      await raw(
        `INSERT INTO wins (child_id, title, hard_start, now_text, created_on, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ids[slug], w.title, w.hard || null, w.now, today, wOrder]
      );
      winCount++;
    }
  }
  console.log(`🏆 승리 장부 ${winCount}개`);

  // ---- 과목 진도 ----
  let subCount = 0;
  for (const slug of ["juju1", "juju2"] as const) {
    await raw(`DELETE FROM subjects WHERE child_id = $1`, [ids[slug]]);
    let sOrder = 0;
    for (const s of SUBJECTS[slug]) {
      sOrder += 10;
      await raw(
        `INSERT INTO subjects (child_id, subject, unit, status, owner, sort_order)
         VALUES ($1,$2,$3,'doing',$4,$5)`,
        [ids[slug], s.subject, s.unit, s.owner, sOrder]
      );
      subCount++;
    }
  }
  console.log(`📚 과목 진도 ${subCount}개`);

  const [{ count }] = await sql<{ count: string }>`SELECT count(*)::text AS count FROM task_defs`;
  console.log(`\n🌱 시드 완료 — task_defs ${count}행`);
  console.log("   PIN 초기값: 쭈1 1001 / 쭈2 1002 / 아빠 2001 / 엄마 2002");
  console.log("   ⚠️  배포 후 부모 화면에서 반드시 바꾸십시오.");

  await closePool();
}

main().catch((e) => {
  console.error("❌ 시드 실패:", e);
  process.exit(1);
});
