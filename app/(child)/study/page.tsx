import { currentUser } from "@/lib/auth";
import { subjectsFor, tasksForDate, logsFor } from "@/lib/queries";
import { Section } from "@/components/Section";
import { TaskItem } from "@/components/TaskControls";
import { SubjectRow } from "./SubjectRow";
import { todayKST } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const u = (await currentUser())!;
  const date = todayKST();
  const [subjects, tasks, logs] = await Promise.all([
    subjectsFor(u.id), tasksForDate(u.id, date), logsFor(u.id, date),
  ]);

  const studyTasks = tasks.filter(
    (t) => (t.category === "study" || t.category === "money") && t.kind === "fixed"
  );

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">공부</h1>
        <p className="mt-1 text-sm text-slate-500">
          많이 하는 게 아니라 <b>매일 조금</b>이 목표야.
        </p>
      </div>

      <div className="mt-4">
        <Section title="오늘 할 공부">
          {studyTasks.map((t) => (
            <TaskItem
              key={t.task_key}
              task={{
                task_key: t.task_key, label: t.label, emoji: t.emoji,
                value_type: t.value_type, target_num: null, unit: null,
                choice_group: null, hint: t.hint,
              }}
              value={logs.get(t.task_key)}
              size={u.uiSize}
            />
          ))}
        </Section>

        <Section title="과목별 지금 어디까지">
          {subjects.map((s) => <SubjectRow key={s.id} subject={s} />)}
        </Section>
      </div>
    </main>
  );
}
