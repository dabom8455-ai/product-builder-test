import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { winsFor, progressFor } from "@/lib/queries";
import { Section, Empty } from "@/components/Section";

export const dynamic = "force-dynamic";

export default async function WinsPage() {
  const u = (await currentUser())!;
  const [wins, p] = await Promise.all([winsFor(u.id), progressFor(u.id)]);

  return (
    <main className="px-4 pt-5">
      <h1 className="text-xl font-bold">
        {u.displayName}가 해낸 것
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        여기는 할 일을 적는 곳이 아니야. 네가 <b>이미 해낸 것</b>만 모아두는 곳이야.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="기록한 날" value={`${p.totalDays}일`} />
        <Stat label="지금 이어서" value={`${p.currentStreak}일`} />
        <Stat label="이번 주 체크" value={`${p.weekChecks}개`} />
      </div>
      {p.bestStreak > p.currentStreak && (
        <p className="mt-2 text-center text-xs text-slate-400">
          가장 길게 이어간 기록 {p.bestStreak}일 — 끊겨도 0으로 돌아가지 않아
        </p>
      )}

      <div className="mt-5">
        <Section title={`🏆 승리 장부 ${wins.length}개`}>
          {wins.length === 0 && <Empty>아직 비어 있어. 하나씩 채워 넣자.</Empty>}
          {wins.map((w) => (
            <div key={w.id} className="px-4 py-3">
              <p className="font-bold">{w.title}</p>
              {w.hard_start && (
                <p className="mt-1 text-xs text-slate-400">
                  처음엔 — {w.hard_start}
                </p>
              )}
              {w.now_text && (
                <p className="mt-0.5 text-sm text-emerald-700">지금은 — {w.now_text}</p>
              )}
            </div>
          ))}
        </Section>
      </div>

      <Link
        href="/today"
        className="tap-lg mb-8 flex items-center justify-center rounded-2xl bg-blue-600 text-base font-bold text-white shadow-sm active:scale-[0.98]"
      >
        오늘 체크하기 ({p.todayChecks}/{p.todayTotal})
      </Link>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-2 py-3 text-center shadow-sm">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{label}</p>
    </div>
  );
}
