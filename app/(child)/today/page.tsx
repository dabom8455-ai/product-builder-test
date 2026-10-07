import { currentUser } from "@/lib/auth";
import {
  tasksForDate, logsFor, passCardThisMonth, type TaskDef,
} from "@/lib/queries";
import { Section } from "@/components/Section";
import { TaskItem, type TaskView } from "@/components/TaskControls";
import { PassCardButton } from "./PassCardButton";
import { DayPicker } from "./DayPicker";
import { todayKST, recentDates, displayDate } from "@/lib/date";

export const dynamic = "force-dynamic";

function toView(t: TaskDef): TaskView {
  return {
    task_key: t.task_key,
    label: t.label,
    emoji: t.emoji,
    value_type: t.value_type,
    target_num: t.target_num === null ? null : Number(t.target_num),
    unit: t.unit,
    choice_group: t.choice_group,
    hint: t.hint,
  };
}

const SECTIONS: { title: string; note?: string; pick: (t: TaskDef) => boolean }[] = [
  {
    title: "🌙 잠과 아침",
    note: "하루는 전날 밤에 정해진다.",
    pick: (t) => ["sleep_at", "wake_at", "breakfast"].includes(t.task_key),
  },
  {
    title: "🍽 몸에 들어가는 것",
    pick: (t) => t.category === "health" && t.kind === "fixed",
  },
  {
    title: "🏠 내가 챙기는 것",
    pick: (t) => t.category === "life" && t.kind === "fixed",
  },
  {
    title: "💪 운동",
    pick: (t) => t.category === "exercise",
  },
  {
    title: "📚 공부",
    note: "분량이 아니라 '했는지'만 체크한다.",
    pick: (t) => (t.category === "study" || t.category === "money") && t.kind === "fixed",
  },
  {
    title: "🟡 오늘의 선택 — 하나만 골라",
    note: "고르는 것도 연습이다. 하나 고르면 나머지는 지워진다.",
    pick: (t) => t.kind === "choice",
  },
  {
    title: "👬 사람 · 안전",
    pick: (t) => t.category === "relation" || t.category === "safety",
  },
  {
    title: "🧠 마음",
    note: "'잘 안 된 것'은 혼나는 칸이 아니다. 적는 것 자체가 승리다.",
    pick: (t) => t.category === "mind",
  },
];

export default async function TodayPage({
  searchParams,
}: { searchParams: Promise<{ d?: string }> }) {
  const u = (await currentUser())!;
  const sp = await searchParams;
  const allowed = recentDates(7);
  const date = sp.d && allowed.includes(sp.d) ? sp.d : todayKST();

  const [tasks, logs, pass] = await Promise.all([
    tasksForDate(u.id, date),
    logsFor(u.id, date),
    passCardThisMonth(u.id, date),
  ]);

  const used = new Set<string>();
  const groups = SECTIONS.map((s) => {
    const items = tasks.filter((t) => !used.has(t.task_key) && s.pick(t));
    items.forEach((t) => used.add(t.task_key));
    return { ...s, items };
  }).filter((g) => g.items.length > 0);

  const leftovers = tasks.filter((t) => !used.has(t.task_key));
  if (leftovers.length) groups.push({ title: "그 밖에", pick: () => false, items: leftovers });

  const restDay = pass?.used_on === date;
  const done = tasks.filter((t) => {
    const v = logs.get(t.task_key);
    return v && (v.bool === true || v.num !== null || (v.text ?? "") !== "");
  }).length;

  return (
    <main className="px-0 pt-4">
      <div className="px-4">
        <div className="flex items-end justify-between">
          <h1 className="text-xl font-bold">
            {date === todayKST() ? "오늘" : displayDate(date)}
          </h1>
          <p className="text-sm text-slate-500 tabular-nums">
            {done} / {tasks.length}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }}
          />
        </div>
        <DayPicker dates={allowed} current={date} />
        {restDay && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            🃏 오늘은 포기권을 쓴 날이야. 쉬어도 기록은 끊기지 않아.
          </p>
        )}
      </div>

      <div className="mt-5">
        {groups.map((g) => (
          <Section key={g.title} title={g.title} note={g.note}>
            {g.items.map((t) => (
              <TaskItem
                key={t.task_key}
                task={toView(t)}
                value={logs.get(t.task_key)}
                date={date}
                size={u.uiSize}
              />
            ))}
          </Section>
        ))}
      </div>

      <div className="px-4 pb-8">
        <PassCardButton used={pass?.used_on ?? null} />
        <p className="mt-3 text-center text-xs leading-relaxed text-slate-400">
          못 한 칸은 그냥 비워두면 돼. 빨간 X 는 없어.
        </p>
      </div>
    </main>
  );
}
