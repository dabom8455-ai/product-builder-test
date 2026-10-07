import { notFound } from "next/navigation";
import {
  getChild, tasksForDate, logsFor, injuryPattern, injuriesFor, memosFor,
  alertsFor, winsFor, parentOnlyTasks,
} from "@/lib/queries";
import { Section, Empty } from "@/components/Section";
import { TaskItem } from "@/components/TaskControls";
import {
  recentDates, todayKST, isoWeekday, WEEKDAY_LABELS, sleepMinutes, formatMinutes,
} from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function ChildDetail({
  params,
}: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const id = Number(childId);
  if (!Number.isInteger(id)) notFound();

  const child = await getChild(id);
  if (!child) notFound();

  const today = todayKST();
  const dates = recentDates(14, today);

  const rows = await Promise.all(
    dates.map(async (d) => {
      const [tasks, logs] = await Promise.all([tasksForDate(id, d), logsFor(id, d)]);
      const filled = tasks.filter((t) => {
        const v = logs.get(t.task_key);
        return v && (v.bool === true || v.num !== null || (v.text ?? "") !== "");
      }).length;
      return {
        date: d,
        sleep: logs.get("sleep_at")?.text ?? null,
        wake: logs.get("wake_at")?.text ?? null,
        snack: logs.get("snack_count")?.num ?? null,
        screen: logs.get("screen_min")?.num ?? null,
        mood: logs.get("mood")?.text ?? null,
        exercise: logs.get("exercise_done")?.bool === true,
        weight: logs.get("weight")?.num ?? null,
        height: logs.get("height")?.num ?? null,
        filled,
        total: tasks.length,
      };
    })
  );

  const [alerts, pattern, injuries, memos, wins, parentTasks, todayLogs] =
    await Promise.all([
      alertsFor(child, today),
      injuryPattern(id),
      injuriesFor(id, 10),
      memosFor(id, 10),
      winsFor(id),
      parentOnlyTasks(id),
      logsFor(id, today),
    ]);

  const parentOnly = parentTasks;
  const weights = rows.filter((r) => r.weight !== null).reverse();

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">
          {child.emoji} {child.display_name} · {child.grade_label}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          체중·키는 이 화면에만 보입니다. 아이 화면에는 숫자가 나가지 않습니다.
        </p>
      </div>

      <div className="mt-4">
        {alerts.length > 0 && (
          <Section title="지금 확인할 것">
            {alerts.map((a, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-sm font-bold">
                  {a.level === "high" ? "🚨" : "⚠️"} {a.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{a.detail}</p>
              </div>
            ))}
          </Section>
        )}

        {parentOnly.length > 0 && (
          <Section title="⚖️ 부모만 입력" note="주 1회(일요일)만 재면 충분합니다. 매일 재면 아이가 숫자에 민감해집니다.">
            {parentOnly.map((t) => (
              <TaskItem
                key={t.task_key}
                task={{
                  task_key: t.task_key, label: t.label, emoji: t.emoji,
                  value_type: t.value_type,
                  target_num: t.target_num === null ? null : Number(t.target_num),
                  unit: t.unit, choice_group: null, hint: t.hint,
                }}
                value={todayLogs.get(t.task_key)}
                childId={id}
              />
            ))}
            {weights.length > 0 && (
              <div className="px-4 py-3">
                <p className="mb-1 text-xs font-bold text-slate-500">체중 기록</p>
                <p className="text-sm tabular-nums text-slate-600">
                  {weights.map((w) => `${w.date.slice(5)} ${w.weight}kg`).join("  →  ")}
                </p>
              </div>
            )}
          </Section>
        )}

        <Section title="최근 2주" note="빈칸은 입력이 없었던 날입니다. 벌점이 아니라 '시스템이 돌았는지' 신호입니다.">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-2 py-2 text-left font-medium">날짜</th>
                  <th className="px-1 py-2 font-medium">수면</th>
                  <th className="px-1 py-2 font-medium">간식</th>
                  <th className="px-1 py-2 font-medium">화면</th>
                  <th className="px-1 py-2 font-medium">운동</th>
                  <th className="px-1 py-2 font-medium">기분</th>
                  <th className="px-1 py-2 font-medium">체크</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sm = sleepMinutes(r.sleep, r.wake);
                  return (
                    <tr key={r.date} className="border-t border-slate-100">
                      <td className="px-2 py-2 whitespace-nowrap text-slate-500">
                        {r.date.slice(5)} {WEEKDAY_LABELS[isoWeekday(r.date) - 1]}
                      </td>
                      <td className="px-1 py-2 text-center tabular-nums">
                        {sm === null ? "–" : formatMinutes(sm).replace("시간 ", "h")}
                      </td>
                      <td className={`px-1 py-2 text-center tabular-nums ${r.snack !== null && r.snack > 1 ? "font-bold text-rose-600" : ""}`}>
                        {r.snack ?? "–"}
                      </td>
                      <td className="px-1 py-2 text-center tabular-nums">{r.screen ?? "–"}</td>
                      <td className="px-1 py-2 text-center">{r.exercise ? "✓" : "–"}</td>
                      <td className="px-1 py-2 text-center">{r.mood ?? "–"}</td>
                      <td className="px-1 py-2 text-center tabular-nums text-slate-500">
                        {r.filled}/{r.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="🛡 안전 패턴" note="다친 시간대가 몰려 있으면 그 시간의 환경을 바꾸는 것이 잔소리보다 빠릅니다.">
          {pattern.length === 0 && <Empty>다친 기록이 없습니다.</Empty>}
          {pattern.map((p, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-12 text-sm">{p.time_of_day ?? "미기록"}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-slate-400"
                  style={{ width: `${Math.min(100, Number(p.c) * 25)}%` }}
                />
              </div>
              <span className="w-8 text-right text-sm tabular-nums">{p.c}회</span>
            </div>
          ))}
          {injuries.map((i) => (
            <div key={i.id} className="px-4 py-2 text-xs text-slate-500">
              {i.log_date} · {i.part} {i.situation ? `— ${i.situation}` : ""}
            </div>
          ))}
        </Section>

        <Section title={`🏆 승리 장부 ${wins.length}개`} note="한 주에 하나씩 더 찾아서 넣어주십시오. 이것이 아이의 자기 신뢰 재고입니다.">
          {wins.map((w) => (
            <div key={w.id} className="px-4 py-2 text-sm">
              {w.title}
            </div>
          ))}
        </Section>

        <Section title="관찰 메모" note="아이에게 보이지 않습니다.">
          {memos.length === 0 && <Empty>메모가 없습니다.</Empty>}
          {memos.map((m) => (
            <div key={m.id} className="px-4 py-2.5">
              <p className="text-[11px] text-slate-400">{m.memo_date}</p>
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </Section>
      </div>
    </main>
  );
}
