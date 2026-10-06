"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApp, useMaps } from "@/lib/store";
import { usePayrolls, usePnl, useMenuAnalysis } from "@/lib/hooks";
import { addDays, addMonths, daysInMonth, DOW_LABEL, dayOfWeek, todayLocal } from "@/lib/dates";
import { linePrice } from "@/lib/domain/pnl";
import { QUADRANT_INFO } from "@/lib/domain/menuEngineering";
import { Badge, Bar, Card, PageHeader, Stat } from "@/components/ui";
import { man, pct, won } from "@/lib/format";

export default function Home() {
  const today = todayLocal();
  const month = today.slice(0, 7);
  const lastMonth = addMonths(month, -1);
  const sales = useApp((s) => s.sales);
  const reviews = useApp((s) => s.reviews);
  const attendance = useApp((s) => s.attendance);
  const employees = useApp((s) => s.employees);
  const store = useApp((s) => s.store);
  const { menuMap, unitCosts } = useMaps();
  const pnlThis = usePnl(month);
  const pnlLast = usePnl(lastMonth);
  const payrolls = usePayrolls(month);
  const analysis = useMenuAnalysis(56);

  const daily = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const totals = new Map(days.map((d) => [d, 0]));
    for (const l of sales) {
      if (!totals.has(l.date)) continue;
      const m = menuMap.get(l.menuId);
      if (m) totals.set(l.date, totals.get(l.date)! + linePrice(m, l.channel) * l.qty);
    }
    return days.map((d) => ({ date: d, total: totals.get(d)! }));
  }, [sales, menuMap, today]);
  const maxDaily = Math.max(...daily.map((d) => d.total), 1);
  const yesterday = daily[daily.length - 2];
  const todayTotal = daily[daily.length - 1].total;

  const elapsed = Number(today.slice(8, 10)) - 1 || 1;
  const projected = (pnlThis.grossSales / elapsed) * daysInMonth(month);

  const pendingReviews = reviews.filter((r) => r.status !== "posted");
  const negPending = pendingReviews.filter((r) => r.sentiment === "negative");
  const working = attendance.filter((a) => !a.clockOut && a.clockIn.startsWith(today));

  const overCost = useMemo(
    () =>
      [...menuMap.values()]
        .filter((m) => !m.isSub && m.active && m.price > 0)
        .map((m) => ({ m, ratio: (unitCosts.get(m.id) ?? 0) / m.price }))
        .filter(({ m, ratio }) => ratio > (m.category === "drink" ? store.targetCostRatio.drink : store.targetCostRatio.dessert)),
    [menuMap, unitCosts, store.targetCostRatio],
  );
  const laborWarnings = payrolls.flatMap((p) => p.payroll.warnings.map((w) => `${p.employee.name}: ${w}`));

  return (
    <div className="space-y-5">
      <PageHeader title="오늘의 카페" desc={`${today} (${DOW_LABEL[dayOfWeek(today)]}) · 매출 데이터가 들어오면 아래 숫자가 모두 자동으로 갱신됩니다.`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="오늘 매출" value={won(todayTotal)} sub={todayTotal === 0 ? <Link className="underline" href="/sales">마감 입력하기 →</Link> : undefined} />
        <Stat label="어제 매출" value={won(yesterday.total)} sub={`${DOW_LABEL[dayOfWeek(yesterday.date)]}요일`} />
        <Stat label="이번 달 누적 매출" value={man(pnlThis.grossSales) + "원"} sub={`월말 예상 ${man(projected)}원`} />
        <Stat
          label={`지난달(${lastMonth.slice(5)}월) 순수익`}
          value={won(pnlLast.operatingProfit)}
          tone={pnlLast.operatingProfit >= 0 ? "good" : "bad"}
          sub={pnlLast.grossSales > 0 ? `순이익률 ${pct(pnlLast.operatingProfit / pnlLast.grossSales)}` : "데이터 없음"}
        />
      </div>

      <Card title="최근 14일 매출" right={<Link href="/pnl" className="text-sm text-brand">손익 보기 →</Link>}>
        <div className="flex h-36 items-end gap-1">
          {daily.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col items-center gap-1" title={`${d.date} ${won(d.total)}`}>
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t bg-brand/80" style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total ? 2 : 0 }} />
              </div>
              <span className={`text-[10px] ${dayOfWeek(d.date) === 0 ? "text-bad" : "text-ink-2"}`}>{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="오늘의 제안" right={<Link href="/analysis" className="text-sm text-brand">메뉴 분석 →</Link>}>
          <ul className="space-y-3">
            {analysis.suggestions
              .filter((s) => s.action !== "keep")
              .slice(0, 4)
              .map((s) => (
                <li key={s.menuId + s.action} className="text-sm">
                  <div className="font-medium">
                    {QUADRANT_INFO[s.quadrant].emoji} {s.title}
                  </div>
                  <div className="text-xs text-ink-2">{s.detail}</div>
                  {s.action === "promote" && (
                    <Link href={`/poster?menu=${s.menuId}`} className="mt-1 inline-block text-xs text-brand underline">
                      포스터 만들기
                    </Link>
                  )}
                </li>
              ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="답글 대기 리뷰" right={<Link href="/reviews" className="text-sm text-brand">답글 달기 →</Link>}>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold tabular">{pendingReviews.length}</span>
              {negPending.length > 0 && <Badge tone="bad">부정 리뷰 {negPending.length}건 — 먼저 확인</Badge>}
            </div>
          </Card>
          <Card title="지금 근무 중" right={<Link href="/staff" className="text-sm text-brand">출퇴근 →</Link>}>
            {working.length === 0 ? (
              <p className="text-sm text-ink-2">출근 기록된 직원이 없습니다.</p>
            ) : (
              <ul className="text-sm">
                {working.map((a) => (
                  <li key={a.id}>
                    {employees.find((e) => e.id === a.employeeId)?.name} · {a.clockIn.slice(11)} 출근
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {(overCost.length > 0 || laborWarnings.length > 0) && (
        <Card title="⚠️ 확인 필요">
          <ul className="space-y-2 text-sm">
            {overCost.map(({ m, ratio }) => (
              <li key={m.id}>
                <Link href="/menu" className="underline">
                  {m.name}
                </Link>{" "}
                원가율 {pct(ratio)} — 목표 {pct(m.category === "drink" ? store.targetCostRatio.drink : store.targetCostRatio.dessert, 0)} 초과
                <div className="mt-1 max-w-xs">
                  <Bar value={ratio} max={0.6} tone="bad" />
                </div>
              </li>
            ))}
            {laborWarnings.map((w) => (
              <li key={w}>👤 {w}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
