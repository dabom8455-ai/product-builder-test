import { listChildren, allTaskDefs, listProfiles } from "@/lib/queries";
import { Section } from "@/components/Section";
import { actCreateTask, actChangePin } from "@/app/actions";
import { TaskToggle } from "./TaskToggle";
import { WEEKDAY_LABELS } from "@/lib/date";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  fixed: "🔴 고정", choice: "🟡 선택", free: "🟢 자유",
};

export default async function TasksPage() {
  const [children, profiles] = await Promise.all([listChildren(), listProfiles()]);
  const sets = await Promise.all(
    children.map(async (c) => ({ child: c, tasks: await allTaskDefs(c.id) }))
  );

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">항목 관리</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          항목을 끄면 아이 화면에서 사라지지만 지난 기록은 남습니다.
          한 번에 많이 켜지 마십시오 — 하루 입력이 1분을 넘으면 아이는 포기합니다.
        </p>
      </div>

      <div className="mt-4">
        <Section title="➕ 항목 추가">
          <form action={actCreateTask} className="space-y-2 px-4 py-3">
            <select name="child_id" className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base">
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input name="emoji" placeholder="⭐" maxLength={2}
                className="tap w-16 rounded-xl border-2 border-slate-200 bg-slate-50 text-center text-base" />
              <input name="label" required placeholder="항목 이름"
                className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base" />
            </div>
            <div className="flex gap-2">
              <select name="category" className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-sm">
                <option value="health">건강</option>
                <option value="life">생활</option>
                <option value="study">공부</option>
                <option value="exercise">운동</option>
                <option value="mind">마음</option>
                <option value="relation">관계</option>
                <option value="money">경제</option>
                <option value="safety">안전</option>
              </select>
              <select name="kind" className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-sm">
                <option value="fixed">🔴 고정</option>
                <option value="choice">🟡 선택</option>
                <option value="free">🟢 자유</option>
              </select>
              <select name="value_type" className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-sm">
                <option value="bool">체크</option>
                <option value="num">숫자</option>
                <option value="time">시각</option>
                <option value="text">글</option>
                <option value="mood">기분</option>
              </select>
            </div>
            <div className="flex gap-2">
              <input name="target_num" type="number" placeholder="목표 숫자"
                className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm" />
              <input name="unit" placeholder="단위 (컵·분)"
                className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm" />
            </div>
            <input name="hint" placeholder="아이에게 보여줄 한 줄 설명"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-sm" />
            <button type="submit" className="tap w-full rounded-xl bg-blue-600 text-sm font-bold text-white">
              추가
            </button>
          </form>
        </Section>

        {sets.map((s) => (
          <Section
            key={s.child.id}
            title={`${s.child.emoji} ${s.child.display_name} — ${s.tasks.filter((t) => t.is_active).length} / ${s.tasks.length} 켜짐`}
          >
            {s.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-lg" aria-hidden>{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${t.is_active ? "" : "text-slate-400 line-through"}`}>
                    {t.label}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {KIND_LABEL[t.kind]} · {t.task_key}
                    {t.weekdays && ` · ${t.weekdays.map((w) => WEEKDAY_LABELS[w - 1]).join("")}`}
                    {t.parent_only && " · 부모만"}
                  </p>
                </div>
                <TaskToggle id={t.id} active={t.is_active} />
              </div>
            ))}
          </Section>
        ))}

        <Section title="🔑 비밀번호 바꾸기" note="초기값은 쭈1 1001 / 쭈2 1002 / 아빠 2001 / 엄마 2002 입니다. 지금 바꾸십시오.">
          <form action={actChangePin} className="space-y-2 px-4 py-3">
            <select name="slug" className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base">
              {profiles.map((p) => (
                <option key={p.slug} value={p.slug}>{p.display_name}</option>
              ))}
            </select>
            <input
              name="pin" required inputMode="numeric" pattern="\d{4}" maxLength={4}
              placeholder="새 비밀번호 4자리"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-center text-lg tracking-widest"
            />
            <button type="submit" className="tap w-full rounded-xl bg-slate-700 text-sm font-bold text-white">
              바꾸기
            </button>
          </form>
        </Section>
      </div>
    </main>
  );
}
