import { currentUser } from "@/lib/auth";
import { booksFor, moneyFor, injuriesFor } from "@/lib/queries";
import { Section, Empty } from "@/components/Section";
import { actAddBook, actAddMoney, actAddInjury } from "@/app/actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  income: "받음", spend: "씀", save: "모음", give: "나눔",
};

export default async function RecordPage() {
  const u = (await currentUser())!;
  const [books, money, injuries] = await Promise.all([
    booksFor(u.id), moneyFor(u.id), injuriesFor(u.id),
  ]);

  const saved = money.filter((m) => m.kind === "save").reduce((a, b) => a + b.amount, 0);

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">기록</h1>
        <p className="mt-1 text-sm text-slate-500">쌓이면 증거가 된다.</p>
      </div>

      <div className="mt-4">
        <Section title={`📚 읽은 책 ${books.length}권`}>
          <form action={actAddBook} className="space-y-2 px-4 py-3">
            <input
              name="title" required placeholder="책 제목"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base"
            />
            <input
              name="one_line" placeholder="한 줄 느낌 (안 써도 돼)"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base"
            />
            <button type="submit" className="tap w-full rounded-xl bg-blue-600 text-sm font-bold text-white">
              다 읽었어
            </button>
          </form>
          {books.length === 0 && <Empty>첫 번째 책을 기다리고 있어.</Empty>}
          {books.map((b) => (
            <div key={b.id} className="px-4 py-3">
              <p className="font-medium">{b.title}</p>
              {b.one_line && <p className="mt-0.5 text-sm text-slate-500">{b.one_line}</p>}
              <p className="mt-0.5 text-[11px] text-slate-400">{b.finished_on}</p>
            </div>
          ))}
        </Section>

        <Section title="💰 용돈" note={`지금까지 모은 돈 ${saved.toLocaleString()}원`}>
          <form action={actAddMoney} className="space-y-2 px-4 py-3">
            <div className="flex gap-2">
              <select
                name="kind"
                className="tap rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-base"
              >
                <option value="income">받음</option>
                <option value="spend">씀</option>
                <option value="save">모음</option>
                <option value="give">나눔</option>
              </select>
              <input
                name="amount" type="number" min="1" required placeholder="금액"
                className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base"
              />
            </div>
            <input
              name="memo" placeholder="어디에 썼어?"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base"
            />
            <button type="submit" className="tap w-full rounded-xl bg-blue-600 text-sm font-bold text-white">
              적기
            </button>
          </form>
          {money.length === 0 && <Empty>아직 기록이 없어.</Empty>}
          {money.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-12 shrink-0 text-xs text-slate-400">{KIND_LABEL[m.kind]}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{m.memo ?? ""}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {m.amount.toLocaleString()}원
              </span>
            </div>
          ))}
        </Section>

        <Section title="🛡 다친 곳" note="어디서 왜 다쳤는지 모으면, 다음엔 피할 수 있다.">
          <form action={actAddInjury} className="space-y-2 px-4 py-3">
            <input
              name="part" required placeholder="어디를 다쳤어? (무릎, 손가락…)"
              className="tap w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base"
            />
            <div className="flex gap-2">
              <select
                name="time_of_day"
                className="tap rounded-xl border-2 border-slate-200 bg-slate-50 px-2 text-base"
              >
                {["아침", "오전", "점심", "오후", "저녁", "밤"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                name="situation" placeholder="뭐 하다가?"
                className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base"
              />
            </div>
            <button type="submit" className="tap w-full rounded-xl bg-slate-600 text-sm font-bold text-white">
              적기
            </button>
          </form>
          {injuries.length === 0 && <Empty>다친 기록이 없어. 제일 좋은 상태야.</Empty>}
          {injuries.map((i) => (
            <div key={i.id} className="px-4 py-2.5">
              <p className="text-sm">
                <b>{i.part}</b>
                {i.time_of_day && <span className="text-slate-400"> · {i.time_of_day}</span>}
              </p>
              {i.situation && <p className="text-xs text-slate-500">{i.situation}</p>}
              <p className="text-[11px] text-slate-400">{i.log_date}</p>
            </div>
          ))}
        </Section>
      </div>
    </main>
  );
}
