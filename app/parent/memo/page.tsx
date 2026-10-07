import { listChildren, memosFor } from "@/lib/queries";
import { Section, Empty } from "@/components/Section";
import { actAddMemo, actAddWin } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function MemoPage() {
  const children = await listChildren();
  const memos = await Promise.all(
    children.map(async (c) => ({ child: c, items: await memosFor(c.id, 20) }))
  );

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">관찰 메모 · 승리 추가</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          메모는 아이 화면에 절대 보이지 않습니다. 승리 장부는 아이 첫 화면에 바로 뜹니다.
        </p>
      </div>

      <div className="mt-4">
        <Section title="🏆 승리 하나 추가" note="아이가 '해냈다'고 느낄 증거를 어른이 찾아서 넣어주는 칸입니다.">
          <form action={actAddWin} className="space-y-2 px-4 py-3">
            <select name="child_id" className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base">
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
            <input name="title" required placeholder="무엇을 해냈나 (예: 체스로 친구를 이겼다)"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base" />
            <input name="hard_start" placeholder="처음엔 어땠나 (예: 계속 졌다)"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base" />
            <input name="now_text" placeholder="지금은 어떤가 (예: 혼자 연습해서 이겼다)"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base" />
            <button type="submit" className="tap w-full rounded-xl bg-amber-500 text-sm font-bold text-white">
              승리 장부에 넣기
            </button>
          </form>
        </Section>

        <Section title="메모 쓰기">
          <form action={actAddMemo} className="space-y-2 px-4 py-3">
            <select name="child_id" className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base">
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name}</option>
              ))}
            </select>
            <textarea name="body" required rows={4} placeholder="오늘 관찰한 것, 통화에서 들은 것…"
              className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-base" />
            <button type="submit" className="tap w-full rounded-xl bg-blue-600 text-sm font-bold text-white">
              저장
            </button>
          </form>
        </Section>

        {memos.map((m) => (
          <Section key={m.child.id} title={`${m.child.emoji} ${m.child.display_name}`}>
            {m.items.length === 0 && <Empty>메모가 없습니다.</Empty>}
            {m.items.map((x) => (
              <div key={x.id} className="px-4 py-2.5">
                <p className="text-[11px] text-slate-400">{x.memo_date}</p>
                <p className="text-sm whitespace-pre-wrap">{x.body}</p>
              </div>
            ))}
          </Section>
        ))}
      </div>
    </main>
  );
}
