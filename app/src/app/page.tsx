"use client";

import Link from "next/link";
import { useApp, useMaps } from "@/lib/store";
import { usePnl, useMenuAnalysis } from "@/lib/hooks";
import { addDays, addMonths, businessDays, DOW_LABEL, dayOfWeek, todayLocal, weekStart } from "@/lib/dates";
import { linePrice } from "@/lib/domain/pnl";
import { QUADRANT_INFO } from "@/lib/domain/menuEngineering";
import { buildTodos } from "@/lib/domain/todos";
import { WEATHER } from "@/lib/types";
import { Badge, Bar, Card, PageHeader, Stat } from "@/components/ui";
import { man, pct, won } from "@/lib/format";

const LEVEL = { urgent: { label: "지금", tone: "bad" }, normal: { label: "오늘", tone: "warn" }, info: { label: "참고", tone: undefined } } as const;

export default function Home() {
  const today = todayLocal();
  const month = today.slice(0, 7);
  const lastMonth = addMonths(month, -1);
  const s = useApp();
  const { menuMap, unitCosts } = useMaps();
  const pnlThis = usePnl(month);
  const pnlLast = usePnl(lastMonth);
  const analysis = useMenuAnalysis(56);

  const dayTotal = new Map<string, number>();
  for (const l of s.sales) {
    const m = menuMap.get(l.menuId);
    if (m) dayTotal.set(l.date, (dayTotal.get(l.date) ?? 0) + linePrice(m, l.channel) * l.qty);
  }
  const total = (d: string) => dayTotal.get(d) ?? 0;

  const daily = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => ({ date: d, total: total(d) }));
  const maxDaily = Math.max(...daily.map((d) => d.total), 1);
  const yesterday = addDays(today, -1);

  // 이번 주(월~어제) vs 지난주 같은 요일까지
  const ws = weekStart(today);
  const thisWeekDays = Array.from({ length: Math.max(0, (dayOfWeek(today) + 6) % 7) }, (_, i) => addDays(ws, i));
  const thisWeek = thisWeekDays.reduce((t, d) => t + total(d), 0);
  const lastWeek = thisWeekDays.reduce((t, d) => t + total(addDays(d, -7)), 0);

  // 월 목표: 남은 영업일 기준 하루 필요 매출
  const target = s.store.monthlySalesTarget;
  const openDaysTotal = businessDays(month, s.store.closedDays);
  let openDaysLeft = 0;
  for (let d = today; d.startsWith(month); d = addDays(d, 1)) if (!s.store.closedDays.includes(dayOfWeek(d))) openDaysLeft++;
  const remaining = Math.max(0, target - pnlThis.grossSales);
  const elapsedOpen = Math.max(1, openDaysTotal - openDaysLeft);
  const projected = (pnlThis.grossSales / elapsedOpen) * openDaysTotal;

  const todos = buildTodos({
    today,
    store: s.store,
    sales: s.sales,
    reviews: s.reviews,
    attendance: s.attendance,
    employees: s.employees,
    shifts: s.shifts,
    menus: s.menus,
    unitCosts,
  });
  const working = s.attendance.filter((a) => !a.clockOut && a.clockIn.startsWith(today));
  const todayNote = s.dayNotes.find((n) => n.date === today);

  return (
    <div className="space-y-5">
      <PageHeader
        title="오늘의 카페"
        desc={`${today} (${DOW_LABEL[dayOfWeek(today)]})${s.store.closedDays.includes(dayOfWeek(today)) ? " · 정기 휴무일" : ""}${todayNote?.weather ? ` · ${WEATHER[todayNote.weather]}` : ""}`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="오늘 매출" value={won(total(today))} sub={total(today) === 0 ? <Link className="underline" href="/sales">마감 입력하기 →</Link> : undefined} />
        <Stat label="어제 매출" value={won(total(yesterday))} sub={`${DOW_LABEL[dayOfWeek(yesterday)]}요일 · 지난주 같은 요일 ${man(total(addDays(yesterday, -7)))}원`} />
        <Stat
          label={`이번 주 (월~어제)`}
          value={man(thisWeek) + "원"}
          tone={thisWeekDays.length === 0 || lastWeek === 0 ? undefined : thisWeek >= lastWeek ? "good" : "bad"}
          sub={thisWeekDays.length === 0 ? "월요일: 지난주 결과는 손익에서" : lastWeek ? `지난주 같은 기간 대비 ${thisWeek >= lastWeek ? "+" : ""}${pct((thisWeek - lastWeek) / lastWeek)}` : "지난주 데이터 없음"}
        />
        <Stat
          label={`지난달(${Number(lastMonth.slice(5))}월) 순수익`}
          value={won(pnlLast.operatingProfit)}
          tone={pnlLast.operatingProfit >= 0 ? "good" : "bad"}
          sub={pnlLast.grossSales > 0 ? `순이익률 ${pct(pnlLast.operatingProfit / pnlLast.grossSales)}` : "데이터 없음"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title="오늘 할 일" right={<span className="text-xs text-ink-2">{todos.filter((t) => t.level !== "info").length}건</span>}>
          {todos.length === 0 ? (
            <p className="text-sm text-ink-2">처리할 일이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-line">
              {todos.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className="flex items-center gap-2 py-2 text-sm hover:text-brand">
                    <Badge tone={LEVEL[t.level].tone}>{LEVEL[t.level].label}</Badge>
                    <span className="min-w-0 flex-1">{t.text}</span>
                    <span aria-hidden className="text-ink-2">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title={`${Number(month.slice(5))}월 목표`} right={<Link href="/settings" className="text-xs text-brand">목표 설정</Link>}>
            {target > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-bold tabular">{pct(pnlThis.grossSales / target, 0)}</span>
                  <span className="text-xs text-ink-2 tabular">
                    {man(pnlThis.grossSales)} / {man(target)}원
                  </span>
                </div>
                <div className="mt-2">
                  <Bar value={pnlThis.grossSales} max={target} tone={projected >= target ? "good" : "brand"} />
                </div>
                <p className="mt-2 text-sm">
                  {remaining === 0 ? (
                    <span className="text-good">이번 달 목표를 달성했습니다.</span>
                  ) : (
                    <>
                      남은 영업일 {openDaysLeft}일, 하루 <b className="tabular">{won(remaining / Math.max(1, openDaysLeft))}</b> 필요
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-ink-2">
                  지금 속도면 월말 {man(projected)}원 ({projected >= target ? "달성 예상" : `${man(target - projected)}원 부족 예상`})
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-2">설정에서 월 매출 목표를 정하면 진행률과 하루 필요 매출을 보여드립니다.</p>
            )}
          </Card>
          <Card title="지금 근무 중" right={<Link href="/staff" className="text-sm text-brand">출퇴근 →</Link>}>
            {working.length === 0 ? (
              <p className="text-sm text-ink-2">출근 기록된 직원이 없습니다.</p>
            ) : (
              <ul className="text-sm">
                {working.map((a) => (
                  <li key={a.id}>
                    {s.employees.find((e) => e.id === a.employeeId)?.name} · {a.clockIn.slice(11)} 출근
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="최근 14일 매출" right={<Link href="/sales" className="text-sm text-brand">달력 보기 →</Link>}>
        <div className="flex h-36 items-end gap-1">
          {daily.map((d) => {
            const note = s.dayNotes.find((n) => n.date === d.date);
            return (
              <div key={d.date} className="flex h-full flex-1 flex-col items-center gap-1" title={`${d.date} ${won(d.total)}${note?.memo ? ` · ${note.memo}` : ""}`}>
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full rounded-t bg-series-1" style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total ? 2 : 0 }} />
                </div>
                <span className={`text-[10px] ${dayOfWeek(d.date) === 0 ? "text-bad" : "text-ink-2"}`}>
                  {d.date.slice(8)}
                  {note?.weather && <span className="hidden sm:inline">{WEATHER[note.weather].split(" ")[0]}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="오늘의 제안" right={<Link href="/analysis" className="text-sm text-brand">메뉴 분석 →</Link>}>
        <ul className="grid gap-3 md:grid-cols-2">
          {analysis.suggestions
            .filter((x) => x.action !== "keep")
            .slice(0, 4)
            .map((x) => (
              <li key={x.menuId + x.action} className="text-sm">
                <div className="font-medium">
                  {QUADRANT_INFO[x.quadrant].emoji} {x.title}
                </div>
                <div className="text-xs text-ink-2">{x.detail}</div>
                {x.action === "promote" && (
                  <Link href={`/poster?menu=${x.menuId}`} className="mt-1 inline-block text-xs text-brand underline">
                    포스터 만들기
                  </Link>
                )}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
