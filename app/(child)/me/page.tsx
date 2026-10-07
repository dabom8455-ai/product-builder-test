import { currentUser } from "@/lib/auth";
import { keepRate, progressFor, winsFor, booksFor } from "@/lib/queries";
import { Section } from "@/components/Section";
import { actLogout } from "@/app/actions";
import { WEEKDAY_LABELS, isoWeekday } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const u = (await currentUser())!;
  const [rate, p, wins, books] = await Promise.all([
    keepRate(u.id, 14), progressFor(u.id), winsFor(u.id), booksFor(u.id),
  ]);

  const badges = [
    { got: p.currentStreak >= 3, emoji: "🌱", label: "3일 연속" },
    { got: p.bestStreak >= 7, emoji: "🔥", label: "7일 연속" },
    { got: p.bestStreak >= 21, emoji: "🏔", label: "21일 연속" },
    { got: wins.length >= 5, emoji: "🏆", label: "승리 5개" },
    { got: wins.length >= 10, emoji: "👑", label: "승리 10개" },
    { got: books.length >= 5, emoji: "📚", label: "책 5권" },
    { got: p.totalDays >= 30, emoji: "📅", label: "30일 기록" },
  ];

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">나의 변화</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          점수가 아니야. <b>얼마나 꾸준히 했는지</b>만 보여줘.
        </p>
      </div>

      <div className="mt-4">
        <Section title="최근 2주 지속률">
          <div className="flex items-end gap-1.5 px-4 pb-2 pt-4" style={{ height: 140 }}>
            {rate.map((r) => {
              const pct = r.total ? Math.round((r.checks / r.total) * 100) : 0;
              return (
                <div key={r.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[9px] tabular-nums text-slate-400">
                    {pct > 0 ? pct : ""}
                  </span>
                  <div
                    className={`w-full rounded-t ${pct >= 70 ? "bg-emerald-500" : pct > 0 ? "bg-blue-400" : "bg-slate-200"}`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                  <span className="text-[9px] text-slate-400">
                    {WEEKDAY_LABELS[isoWeekday(r.date) - 1]}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="px-4 pb-3 text-xs text-slate-400">
            회색은 비어 있는 날이야. 벌점이 아니야.
          </p>
        </Section>

        <Section title="배지">
          <div className="grid grid-cols-4 gap-2 p-4">
            {badges.map((b) => (
              <div
                key={b.label}
                className={`rounded-xl py-3 text-center ${b.got ? "bg-amber-50" : "bg-slate-50 opacity-40"}`}
              >
                <p className="text-2xl" aria-hidden>{b.emoji}</p>
                <p className="mt-1 text-[10px] leading-tight text-slate-600">{b.label}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="px-4 pb-8">
          <form action={actLogout}>
            <button type="submit" className="tap w-full rounded-2xl bg-white text-sm text-slate-400 shadow-sm">
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
