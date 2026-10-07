import { sql, sqlOne, raw } from "./db";
import {
  todayKST, isoWeekday, recentDates, yearMonth, addDays, daysBetween,
} from "./date";

/* ---------- 타입 ---------- */

export type Kind = "fixed" | "choice" | "free";
export type ValueType = "bool" | "num" | "text" | "time" | "mood";

export type TaskDef = {
  id: number;
  child_id: number;
  task_key: string;
  label: string;
  emoji: string;
  category: string;
  kind: Kind;
  value_type: ValueType;
  target_num: string | null;
  unit: string | null;
  weekdays: number[] | null;
  choice_group: string | null;
  hint: string | null;
  phase: number;
  parent_only: boolean;
  is_active: boolean;
  sort_order: number;
};

export type LogValue = {
  bool: boolean | null;
  num: number | null;
  text: string | null;
};

export type Child = {
  id: number;
  slug: string;
  display_name: string;
  age_group: string | null;
  grade_label: string | null;
  theme_color: string;
  emoji: string;
  ui_size: "md" | "lg";
};

/* ---------- 사용자 ---------- */

export function listChildren() {
  return sql<Child>`
    SELECT id, slug, display_name, age_group, grade_label, theme_color, emoji, ui_size
      FROM users WHERE role = 'child' ORDER BY sort_order`;
}

export function getChild(id: number) {
  return sqlOne<Child>`
    SELECT id, slug, display_name, age_group, grade_label, theme_color, emoji, ui_size
      FROM users WHERE id = ${id} AND role = 'child'`;
}

export function listProfiles() {
  return sql<{ slug: string; display_name: string; role: string; emoji: string; theme_color: string }>`
    SELECT slug, display_name, role, emoji, theme_color FROM users ORDER BY sort_order`;
}

/* ---------- 항목 · 기록 ---------- */

/** 해당 날짜(요일)에 보여줄 항목만 돌려준다. */
export async function tasksForDate(
  childId: number,
  date: string,
  opts: { includeParentOnly?: boolean } = {}
): Promise<TaskDef[]> {
  const wd = isoWeekday(date);
  const rows = await sql<TaskDef>`
    SELECT * FROM task_defs
     WHERE child_id = ${childId}
       AND is_active = TRUE
       AND (weekdays IS NULL OR ${wd} = ANY(weekdays))
     ORDER BY sort_order, id`;
  return opts.includeParentOnly ? rows : rows.filter((t) => !t.parent_only);
}

/**
 * 부모 전용 항목은 요일 제한을 걸지 않는다.
 * 체중을 일요일에만 입력할 수 있으면 실제로는 아무도 입력하지 않는다.
 */
export function parentOnlyTasks(childId: number) {
  return sql<TaskDef>`
    SELECT * FROM task_defs
     WHERE child_id = ${childId} AND is_active = TRUE AND parent_only = TRUE
     ORDER BY sort_order, id`;
}

export async function logsFor(childId: number, date: string) {
  const rows = await sql<{
    task_key: string; value_bool: boolean | null;
    value_num: string | null; value_text: string | null;
  }>`SELECT task_key, value_bool, value_num, value_text
       FROM daily_logs WHERE child_id = ${childId} AND log_date = ${date}`;
  const map = new Map<string, LogValue>();
  for (const r of rows) {
    map.set(r.task_key, {
      bool: r.value_bool,
      num: r.value_num === null ? null : Number(r.value_num),
      text: r.value_text,
    });
  }
  return map;
}

export async function setLog(
  childId: number, date: string, taskKey: string, v: Partial<LogValue>
) {
  const empty =
    (v.bool === null || v.bool === undefined || v.bool === false) &&
    (v.num === null || v.num === undefined) &&
    (v.text === null || v.text === undefined || v.text === "");

  // 체크를 해제하면 행을 지운다. "못 한 날"은 빈칸이어야 하고 0 이 아니다.
  if (empty) {
    await raw(
      `DELETE FROM daily_logs WHERE child_id=$1 AND log_date=$2 AND task_key=$3`,
      [childId, date, taskKey]
    );
    return;
  }

  await raw(
    `INSERT INTO daily_logs (child_id, log_date, task_key, value_bool, value_num, value_text)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (child_id, log_date, task_key) DO UPDATE
       SET value_bool = EXCLUDED.value_bool,
           value_num  = EXCLUDED.value_num,
           value_text = EXCLUDED.value_text,
           updated_at = now()`,
    [childId, date, taskKey, v.bool ?? null, v.num ?? null, v.text ?? null]
  );
}

/** 같은 choice_group 안에서 하나만 선택되도록 나머지를 지운다. */
export async function clearChoiceGroup(
  childId: number, date: string, group: string, keepKey: string
) {
  await raw(
    `DELETE FROM daily_logs
      WHERE child_id = $1 AND log_date = $2 AND task_key <> $3
        AND task_key IN (SELECT task_key FROM task_defs
                          WHERE child_id = $1 AND choice_group = $4)`,
    [childId, date, keepKey, group]
  );
}

/* ---------- 집계 ---------- */

function isFilled(v: LogValue | undefined): boolean {
  if (!v) return false;
  return v.bool === true || v.num !== null || (v.text !== null && v.text !== "");
}

export type Progress = {
  totalDays: number;      // 기록이 있는 날의 총합
  currentStreak: number;  // 지금 이어지고 있는 날수
  bestStreak: number;
  weekChecks: number;     // 이번 주(월~일) 체크 수
  todayChecks: number;
  todayTotal: number;
};

/** 기록이 있는 날짜 집합 (포기권 사용일 포함) */
async function activeDates(childId: number, since: string): Promise<Set<string>> {
  const rows = await sql<{ d: string }>`
    SELECT DISTINCT to_char(log_date, 'YYYY-MM-DD') AS d
      FROM daily_logs WHERE child_id = ${childId} AND log_date >= ${since}
    UNION
    SELECT to_char(used_on, 'YYYY-MM-DD') AS d
      FROM pass_cards WHERE child_id = ${childId} AND used_on >= ${since}`;
  return new Set(rows.map((r) => r.d));
}

export async function progressFor(childId: number, date = todayKST()): Promise<Progress> {
  const since = addDays(date, -180);
  const days = await activeDates(childId, since);

  // 연속 일수: 오늘이 비어 있어도 벌하지 않는다. 어제부터 세기 시작한다.
  let cursor = days.has(date) ? date : addDays(date, -1);
  let currentStreak = 0;
  while (days.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  let bestStreak = 0, run = 0;
  const sorted = [...days].sort();
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(d, prev) === 1 ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
    prev = d;
  }

  const wd = isoWeekday(date);
  const weekStart = addDays(date, -(wd - 1));
  const [{ c: weekChecks }] = await sql<{ c: string }>`
    SELECT count(*)::text AS c FROM daily_logs
     WHERE child_id = ${childId} AND log_date >= ${weekStart} AND log_date <= ${date}
       AND (value_bool = TRUE OR value_num IS NOT NULL OR value_text <> '')`;

  const tasks = await tasksForDate(childId, date);
  const logs = await logsFor(childId, date);
  const todayChecks = tasks.filter((t) => isFilled(logs.get(t.task_key))).length;

  return {
    totalDays: days.size,
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    weekChecks: Number(weekChecks),
    todayChecks,
    todayTotal: tasks.length,
  };
}

/** 최근 n일 지속률 — 아이 화면에는 이것만 보여준다 (정답률·체중 아님) */
export async function keepRate(childId: number, n = 14, endDate = todayKST()) {
  const dates = recentDates(n, endDate);
  const out: { date: string; checks: number; total: number }[] = [];
  for (const d of dates) {
    const tasks = await tasksForDate(childId, d);
    const logs = await logsFor(childId, d);
    out.push({
      date: d,
      checks: tasks.filter((t) => isFilled(logs.get(t.task_key))).length,
      total: tasks.length,
    });
  }
  return out;
}

/* ---------- 승리 장부 ---------- */

export type Win = {
  id: number; title: string; hard_start: string | null;
  now_text: string | null; created_on: string; sort_order: number;
};

export function winsFor(childId: number) {
  return sql<Win>`
    SELECT id, title, hard_start, now_text,
           to_char(created_on,'YYYY-MM-DD') AS created_on, sort_order
      FROM wins WHERE child_id = ${childId} ORDER BY sort_order, id`;
}

export function addWin(childId: number, title: string, hard: string, now: string) {
  return raw(
    `INSERT INTO wins (child_id, title, hard_start, now_text, created_on, sort_order)
     VALUES ($1,$2,$3,$4,$5, COALESCE((SELECT max(sort_order)+10 FROM wins WHERE child_id=$1),10))`,
    [childId, title, hard || null, now || null, todayKST()]
  );
}

/* ---------- 운동 ---------- */

export type ExerciseItem = {
  theme: string; name: string; prescription: string;
};

export function exerciseFor(ageGroup: string, weekday: number) {
  return sql<ExerciseItem>`
    SELECT theme, name, prescription FROM exercise_plan
     WHERE age_group = ${ageGroup} AND weekday = ${weekday}
     ORDER BY sort_order, id`;
}

export function exerciseWeek(ageGroup: string) {
  return sql<ExerciseItem & { weekday: number }>`
    SELECT weekday, theme, name, prescription FROM exercise_plan
     WHERE age_group = ${ageGroup} ORDER BY weekday, sort_order, id`;
}

/* ---------- 과목 · 책 · 용돈 · 다친 곳 ---------- */

export type Subject = {
  id: number; subject: string; unit: string;
  status: "todo" | "doing" | "done"; owner: string | null;
};

export function subjectsFor(childId: number) {
  return sql<Subject>`
    SELECT id, subject, unit, status, owner FROM subjects
     WHERE child_id = ${childId} ORDER BY sort_order, id`;
}

export function setSubjectStatus(id: number, childId: number, status: string) {
  return raw(`UPDATE subjects SET status=$1 WHERE id=$2 AND child_id=$3`,
    [status, id, childId]);
}

export function booksFor(childId: number, limit = 50) {
  return sql<{ id: number; title: string; finished_on: string; one_line: string | null }>`
    SELECT id, title, to_char(finished_on,'YYYY-MM-DD') AS finished_on, one_line
      FROM books WHERE child_id = ${childId}
     ORDER BY finished_on DESC, id DESC LIMIT ${limit}`;
}

export function addBook(childId: number, title: string, oneLine: string) {
  return raw(
    `INSERT INTO books (child_id, title, finished_on, one_line) VALUES ($1,$2,$3,$4)`,
    [childId, title, todayKST(), oneLine || null]
  );
}

export function moneyFor(childId: number, limit = 50) {
  return sql<{ id: number; log_date: string; kind: string; amount: number; memo: string | null }>`
    SELECT id, to_char(log_date,'YYYY-MM-DD') AS log_date, kind, amount, memo
      FROM money_log WHERE child_id = ${childId}
     ORDER BY log_date DESC, id DESC LIMIT ${limit}`;
}

export function addMoney(childId: number, kind: string, amount: number, memo: string) {
  return raw(
    `INSERT INTO money_log (child_id, log_date, kind, amount, memo) VALUES ($1,$2,$3,$4,$5)`,
    [childId, todayKST(), kind, amount, memo || null]
  );
}

export function addInjury(
  childId: number, part: string, situation: string, timeOfDay: string
) {
  return raw(
    `INSERT INTO injuries (child_id, log_date, part, situation, time_of_day)
     VALUES ($1,$2,$3,$4,$5)`,
    [childId, todayKST(), part, situation || null, timeOfDay || null]
  );
}

export function injuriesFor(childId: number, limit = 30) {
  return sql<{ id: number; log_date: string; part: string; situation: string | null; time_of_day: string | null }>`
    SELECT id, to_char(log_date,'YYYY-MM-DD') AS log_date, part, situation, time_of_day
      FROM injuries WHERE child_id = ${childId}
     ORDER BY log_date DESC, id DESC LIMIT ${limit}`;
}

/** 다친 시간대 집계 — 부모 화면의 안전 패턴 */
export function injuryPattern(childId: number) {
  return sql<{ time_of_day: string | null; c: string }>`
    SELECT time_of_day, count(*)::text AS c FROM injuries
     WHERE child_id = ${childId} GROUP BY time_of_day ORDER BY count(*) DESC`;
}

/* ---------- 포기권 ---------- */

export async function passCardThisMonth(childId: number, date = todayKST()) {
  return sqlOne<{ used_on: string }>`
    SELECT to_char(used_on,'YYYY-MM-DD') AS used_on FROM pass_cards
     WHERE child_id = ${childId} AND year_month = ${yearMonth(date)}`;
}

export async function usePassCard(childId: number, date = todayKST()) {
  const r = await raw(
    `INSERT INTO pass_cards (child_id, year_month, used_on) VALUES ($1,$2,$3)
     ON CONFLICT (child_id, year_month) DO NOTHING RETURNING id`,
    [childId, yearMonth(date), date]
  );
  return r.rowCount === 1;
}

/* ---------- 부모 ---------- */

export async function lastInputDate(childId: number): Promise<string | null> {
  const r = await sqlOne<{ d: string | null }>`
    SELECT to_char(max(log_date),'YYYY-MM-DD') AS d
      FROM daily_logs WHERE child_id = ${childId}`;
  return r?.d ?? null;
}

export type Alert = {
  level: "high" | "mid" | "low";
  childName: string;
  childId: number;
  title: string;
  detail: string;
};

/**
 * 부모 화면 1번 기능. 감시가 아니라 "시스템이 멈췄는지" 알려주는 장치다.
 * 9월에 무너진 이유가 바로 이게 없었기 때문이다.
 */
export async function alertsFor(child: Child, date = todayKST()): Promise<Alert[]> {
  const out: Alert[] = [];
  const base = { childName: child.display_name, childId: child.id };

  const last = await lastInputDate(child.id);
  const gap = last ? daysBetween(date, last) : 999;
  if (!last) {
    out.push({ ...base, level: "high", title: "아직 기록이 하나도 없습니다",
      detail: "첫 3~4주는 어른이 옆에서 같이 체크해야 합니다." });
  } else if (gap >= 3) {
    out.push({ ...base, level: "high", title: `${gap}일째 기록이 없습니다`,
      detail: `마지막 입력 ${last}. 시스템이 멈춘 상태입니다. 오늘 밤 같이 앉아서 한 번만 채워주세요.` });
  } else if (gap === 2) {
    out.push({ ...base, level: "mid", title: "이틀 비었습니다",
      detail: `마지막 입력 ${last}.` });
  }

  const week = recentDates(7, date);
  const from = week[0];

  const sleepRows = await sql<{ s: string | null; w: string | null; d: string }>`
    SELECT to_char(log_date,'YYYY-MM-DD') AS d,
           max(CASE WHEN task_key='sleep_at' THEN value_text END) AS s,
           max(CASE WHEN task_key='wake_at'  THEN value_text END) AS w
      FROM daily_logs
     WHERE child_id = ${child.id} AND log_date >= ${from} AND log_date <= ${date}
     GROUP BY log_date`;
  const mins = sleepRows
    .map((r) => {
      if (!r.s || !r.w) return null;
      const [sh, sm] = r.s.split(":").map(Number);
      const [wh, wm] = r.w.split(":").map(Number);
      let m = wh * 60 + wm - (sh * 60 + sm);
      if (m < 0) m += 24 * 60;
      return m;
    })
    .filter((m): m is number => m !== null);
  if (mins.length >= 3) {
    const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
    const need = child.age_group === "초1" ? 9 * 60 : 8.5 * 60;
    if (avg < need) {
      out.push({ ...base, level: "mid", title: `수면 평균 ${Math.floor(avg / 60)}시간 ${Math.round(avg % 60)}분`,
        detail: `${child.age_group} 권장보다 부족합니다. 취침 시각을 15분씩 당기는 것부터.` });
    }
  }

  const [{ c: exDays }] = await sql<{ c: string }>`
    SELECT count(DISTINCT log_date)::text AS c FROM daily_logs
     WHERE child_id = ${child.id} AND task_key = 'exercise_done' AND value_bool = TRUE
       AND log_date >= ${from} AND log_date <= ${date}`;
  if (Number(exDays) === 0 && gap < 3) {
    out.push({ ...base, level: "mid", title: "이번 주 운동 0일",
      detail: "하루 10분이면 됩니다. 운동 탭에 요일별 메뉴가 있습니다." });
  }

  const [{ c: snackOver }] = await sql<{ c: string }>`
    SELECT count(*)::text AS c FROM daily_logs
     WHERE child_id = ${child.id} AND task_key = 'snack_count' AND value_num > 1
       AND log_date >= ${from} AND log_date <= ${date}`;
  if (Number(snackOver) >= 3) {
    out.push({ ...base, level: "mid", title: `간식 초과 ${snackOver}일`,
      detail: "집에 과자를 두지 않는 것이 의지력보다 효과적입니다." });
  }

  const [{ c: lowMood }] = await sql<{ c: string }>`
    SELECT count(*)::text AS c FROM daily_logs
     WHERE child_id = ${child.id} AND task_key = 'mood'
       AND value_text IN ('😢','😡') AND log_date >= ${from} AND log_date <= ${date}`;
  if (Number(lowMood) >= 3) {
    out.push({ ...base, level: "high", title: `기분이 안 좋은 날 ${lowMood}일`,
      detail: "이번 주 통화에서 '무슨 일 있었어?' 보다 '요즘 뭐가 제일 힘들어?' 로 물어보십시오." });
  }

  return out;
}

export function memosFor(childId: number, limit = 30) {
  return sql<{ id: number; memo_date: string; body: string }>`
    SELECT id, to_char(memo_date,'YYYY-MM-DD') AS memo_date, body
      FROM parent_memos WHERE child_id = ${childId}
     ORDER BY memo_date DESC, id DESC LIMIT ${limit}`;
}

export function addMemo(childId: number, body: string, date = todayKST()) {
  return raw(`INSERT INTO parent_memos (child_id, memo_date, body) VALUES ($1,$2,$3)`,
    [childId, date, body]);
}

/* ---------- 부모: 항목 관리 ---------- */

export function allTaskDefs(childId: number) {
  return sql<TaskDef>`
    SELECT * FROM task_defs WHERE child_id = ${childId} ORDER BY sort_order, id`;
}

export function toggleTaskActive(id: number, active: boolean) {
  return raw(`UPDATE task_defs SET is_active = $1 WHERE id = $2`, [active, id]);
}

export function createTaskDef(input: {
  childId: number; taskKey: string; label: string; emoji: string;
  category: string; kind: string; valueType: string;
  targetNum: number | null; unit: string | null; hint: string | null;
}) {
  return raw(
    `INSERT INTO task_defs (child_id, task_key, label, emoji, category, kind, value_type,
                            target_num, unit, hint, phase, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,
             COALESCE((SELECT max(sort_order)+10 FROM task_defs WHERE child_id=$1),10))
     ON CONFLICT (child_id, task_key) DO UPDATE
       SET label=EXCLUDED.label, is_active=TRUE`,
    [input.childId, input.taskKey, input.label, input.emoji, input.category,
     input.kind, input.valueType, input.targetNum, input.unit, input.hint]
  );
}

export function setUserPin(slug: string, pinHash: string) {
  return raw(`UPDATE users SET pin_hash=$1, failed_logins=0, locked_until=NULL WHERE slug=$2`,
    [pinHash, slug]);
}
