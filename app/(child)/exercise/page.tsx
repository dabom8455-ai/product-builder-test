import { currentUser } from "@/lib/auth";
import { getChild, exerciseFor, exerciseWeek, logsFor, tasksForDate } from "@/lib/queries";
import { Section } from "@/components/Section";
import { TaskItem } from "@/components/TaskControls";
import { todayKST, isoWeekday, WEEKDAY_LABELS } from "@/lib/date";
import { RestButton } from "./RestButton";

export const dynamic = "force-dynamic";

export default async function ExercisePage() {
  const u = (await currentUser())!;
  const child = await getChild(u.id);
  const age = child?.age_group ?? "초3";
  const date = todayKST();
  const wd = isoWeekday(date);

  const [today, week, logs, tasks] = await Promise.all([
    exerciseFor(age, wd),
    exerciseWeek(age),
    logsFor(u.id, date),
    tasksForDate(u.id, date),
  ]);

  const doneTask = tasks.find((t) => t.task_key === "exercise_done");
  const theme = today[0]?.theme ?? "자유";
  const rested = (logs.get("exercise_rest")?.text ?? "") !== "";

  const byDay = new Map<number, typeof week>();
  for (const e of week) {
    const arr = byDay.get(e.weekday) ?? [];
    arr.push(e);
    byDay.set(e.weekday, arr);
  }

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">
          {WEEKDAY_LABELS[wd - 1]}요일 — {theme}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          10분 안에 끝나. 기구 없이 내 몸으로만 해. 거리는 재지 않아.
        </p>
      </div>

      <div className="mt-4">
        <Section title="오늘 메뉴">
          {today.map((e, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.name}</p>
                <p className="text-sm text-slate-500">{e.prescription}</p>
              </div>
            </div>
          ))}
        </Section>

        {doneTask && (
          <Section title="다 했으면 여기">
            <TaskItem
              task={{
                task_key: doneTask.task_key,
                label: doneTask.label,
                emoji: doneTask.emoji,
                value_type: doneTask.value_type,
                target_num: null,
                unit: null,
                choice_group: null,
                hint: doneTask.hint,
              }}
              value={logs.get(doneTask.task_key)}
              size={u.uiSize}
            />
          </Section>
        )}

        <div className="px-4">
          <RestButton rested={rested} />
        </div>

        <div className="mt-6">
          <Section title="이번 주 전체" note="쉬는 것도 운동 계획의 일부다.">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className={`px-4 py-3 ${d === wd ? "bg-blue-50/60" : ""}`}>
                <p className="text-sm font-bold">
                  {WEEKDAY_LABELS[d - 1]} · {byDay.get(d)?.[0]?.theme ?? "-"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {(byDay.get(d) ?? []).map((e) => `${e.name} ${e.prescription}`).join(" / ")}
                </p>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </main>
  );
}
