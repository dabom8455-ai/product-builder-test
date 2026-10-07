import Link from "next/link";
import { listChildren, alertsFor, progressFor, lastInputDate, type Alert } from "@/lib/queries";
import { Section } from "@/components/Section";
import { todayKST, daysBetween } from "@/lib/date";
import { actLogout } from "@/app/actions";

export const dynamic = "force-dynamic";

const LEVEL_STYLE: Record<Alert["level"], string> = {
  high: "border-rose-300 bg-rose-50",
  mid: "border-amber-300 bg-amber-50",
  low: "border-slate-200 bg-white",
};

export default async function ParentHome() {
  const children = await listChildren();
  const date = todayKST();

  const data = await Promise.all(
    children.map(async (c) => ({
      child: c,
      alerts: await alertsFor(c, date),
      progress: await progressFor(c.id, date),
      last: await lastInputDate(c.id),
    }))
  );

  const allAlerts = data.flatMap((d) => d.alerts);
  const high = allAlerts.filter((a) => a.level === "high");
  const mid = allAlerts.filter((a) => a.level === "mid");

  return (
    <main className="pt-4">
      <div className="px-4">
        <h1 className="text-xl font-bold">
          {allAlerts.length === 0 ? "지금 급한 건 없습니다" : `확인할 것 ${allAlerts.length}건`}
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          이 화면의 목적은 감시가 아니라 <b>시스템이 멈췄는지 알아내는 것</b>입니다.
          9월에 무너진 이유는 이 장치가 없었기 때문입니다.
        </p>
      </div>

      <div className="mt-4 space-y-2 px-4">
        {[...high, ...mid].map((a, i) => (
          <Link
            key={i}
            href={`/parent/${a.childId}`}
            className={`block rounded-2xl border-2 px-4 py-3 ${LEVEL_STYLE[a.level]}`}
          >
            <p className="text-sm font-bold">
              {a.level === "high" ? "🚨" : "⚠️"} {a.childName} — {a.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{a.detail}</p>
          </Link>
        ))}
        {allAlerts.length === 0 && (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-400 shadow-sm">
            기록이 들어오고 있고 수면·운동·간식도 범위 안입니다.
          </p>
        )}
      </div>

      <div className="mt-6">
        {data.map((d) => (
          <Section key={d.child.id} title={`${d.child.emoji} ${d.child.display_name} (${d.child.grade_label ?? ""})`}>
            <div className="grid grid-cols-3 gap-2 p-4">
              <Mini label="오늘 체크" value={`${d.progress.todayChecks}/${d.progress.todayTotal}`} />
              <Mini label="이어서" value={`${d.progress.currentStreak}일`} />
              <Mini label="기록한 날" value={`${d.progress.totalDays}일`} />
            </div>
            <div className="px-4 pb-3 text-xs text-slate-500">
              마지막 입력{" "}
              {d.last
                ? `${d.last} (${daysBetween(date, d.last)}일 전)`
                : "없음"}
            </div>
            <Link
              href={`/parent/${d.child.id}`}
              className="tap flex items-center justify-center border-t border-slate-100 text-sm font-medium text-blue-600"
            >
              추이 자세히 보기
            </Link>
          </Section>
        ))}
      </div>

      <div className="px-4 pb-8">
        <p className="mb-3 rounded-2xl bg-white px-4 py-3 text-xs leading-relaxed text-slate-500 shadow-sm">
          <b>처음 4주 규칙</b> — 아이 혼자 체크하게 두지 마십시오. 밤에 2~3분,
          옆에 앉아서 같이 채우는 것이 설계의 전제입니다. 자율은 그 다음입니다.
        </p>
        <form action={actLogout}>
          <button type="submit" className="tap w-full rounded-2xl bg-white text-sm text-slate-400 shadow-sm">
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 py-2 text-center">
      <p className="text-base font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
