"use client";

import Link from "next/link";
import { useState } from "react";
import { usePayrolls, usePnl } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { addMonths, daysInMonth, todayLocal } from "@/lib/dates";
import { CHANNELS } from "@/lib/types";
import { Bar, Button, Card, Explain, PageHeader, Stat } from "@/components/ui";
import { man, pct, won } from "@/lib/format";

export default function PnlPage() {
  const today = todayLocal();
  const [month, setMonth] = useState(addMonths(today.slice(0, 7), -1));
  const p = usePnl(month);
  const prev = usePnl(addMonths(month, -1));
  const payrolls = usePayrolls(month);
  const store = useApp((s) => s.store);
  const isCurrent = month === today.slice(0, 7);
  const delta = (a: number, b: number) => (b !== 0 ? (a - b) / Math.abs(b) : 0);

  const rows: { label: string; value: number; sign: 1 | -1 | 0; strong?: boolean; note?: string }[] = [
    { label: "총매출", value: p.grossSales, sign: 0, strong: true },
    { label: "부가세(매출세액)", value: p.vat, sign: -1, note: store.vatMode === "general" ? "일반과세: 매출의 1/11" : store.vatMode === "simplified" ? "간이과세 근사" : "면세" },
    { label: "순매출", value: p.netSales, sign: 0, strong: true },
    { label: "재료원가", value: p.cogs, sign: -1, note: "판매수량 × 메뉴별 레시피 원가" },
    { label: "플랫폼·결제 수수료", value: p.fees, sign: -1, note: "채널별 수수료율(설정)" },
    { label: "배달 포장재", value: p.packaging, sign: -1 },
    { label: "매출총이익", value: p.grossProfit, sign: 0, strong: true },
    { label: "인건비", value: p.labor, sign: -1, note: "급여+주휴+가산 + 사업주 4대보험(추정)" },
    { label: "고정비", value: p.fixed, sign: -1, note: "임대료·관리비·감가상각 등" },
    { label: "변동비", value: p.variable, sign: -1, note: "전기·가스·소모품·마케팅" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="손익"
        desc="매출에서 원가·수수료·인건비·고정비를 빼고 실제로 남은 돈을 계산합니다."
        right={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))}>
              ◀
            </Button>
            <span className="w-24 text-center font-semibold tabular">{month}</span>
            <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}>
              ▶
            </Button>
          </div>
        }
      />
      {isCurrent && (
        <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">진행 중인 달입니다. 매출은 오늘까지 누적이지만 고정비는 한 달 전체가 반영되어 순이익이 낮게 보입니다.</p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="총매출" value={man(p.grossSales) + "원"} sub={prev.grossSales ? `전월 대비 ${pct(delta(p.grossSales, prev.grossSales))}` : undefined} />
        <Stat label="순수익(영업이익)" value={won(p.operatingProfit)} tone={p.operatingProfit >= 0 ? "good" : "bad"} sub={p.grossSales ? `순이익률 ${pct(p.operatingProfit / p.grossSales)}` : undefined} />
        <Stat label="원가율" value={p.grossSales ? pct(p.cogs / p.grossSales) : "-"} sub="재료원가 ÷ 총매출" />
        <Stat label="인건비율" value={p.grossSales ? pct(p.labor / p.grossSales) : "-"} sub={<Link href="/staff" className="underline">급여 상세</Link>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card title="월 손익계산">
          <table className="w-full text-sm tabular">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={`border-b border-line/60 ${r.strong ? "font-semibold" : ""}`}>
                  <td className="py-2">
                    {r.sign === -1 ? "− " : ""}
                    {r.label}
                    {r.note && <div className="text-[11px] font-normal text-ink-2">{r.note}</div>}
                  </td>
                  <td className="text-right">{won(r.value)}</td>
                  <td className="w-16 text-right text-xs text-ink-2">{p.grossSales ? pct(r.value / p.grossSales, 0) : ""}</td>
                </tr>
              ))}
              <tr className="text-base font-bold">
                <td className="py-3">= 순수익</td>
                <td className={`text-right ${p.operatingProfit >= 0 ? "text-good" : "text-bad"}`}>{won(p.operatingProfit)}</td>
                <td className="text-right text-xs">{p.grossSales ? pct(p.operatingProfit / p.grossSales, 0) : ""}</td>
              </tr>
            </tbody>
          </table>
          <Explain>
            <p>판매 {p.qty.toLocaleString()}개 · 영업일×채널 {p.orders}건 기준</p>
            {payrolls.map(({ employee, payroll }) => (
              <p key={employee.id}>
                · {employee.name}: 급여 {won(payroll.gross)} + 사업주 보험 {won(payroll.employerInsurance)}
              </p>
            ))}
          </Explain>
        </Card>

        <div className="space-y-4">
          <Card title="손익분기점">
            {p.breakEvenSales > 0 ? (
              <>
                <p className="text-sm">
                  인건비·고정비·변동비를 넘기려면 월 <b className="tabular">{won(p.breakEvenSales)}</b>, 하루 평균{" "}
                  <b className="tabular">{won(p.breakEvenDailySales)}</b> 매출이 필요합니다.
                </p>
                <div className="mt-3">
                  <Bar value={p.grossSales} max={Math.max(p.breakEvenSales, p.grossSales) * 1.1} tone={p.grossSales >= p.breakEvenSales ? "good" : "bad"} />
                  <div className="mt-1 flex justify-between text-xs text-ink-2">
                    <span>현재 {man(p.grossSales)}원</span>
                    <span>{p.grossSales >= p.breakEvenSales ? `손익분기 대비 +${man(p.grossSales - p.breakEvenSales)}원` : `부족 ${man(p.breakEvenSales - p.grossSales)}원`}</span>
                  </div>
                </div>
                <Explain>
                  <p>공헌이익률 = 매출총이익 ÷ 총매출 = {pct(p.grossProfit / (p.grossSales || 1))}</p>
                  <p>손익분기 매출 = (인건비 + 고정비 + 변동비) ÷ 공헌이익률</p>
                  <p>하루 평균 = 월 손익분기 ÷ {daysInMonth(month)}일</p>
                </Explain>
              </>
            ) : (
              <p className="text-sm text-ink-2">이 달 매출 데이터가 없습니다.</p>
            )}
          </Card>

          <Card title="채널별 실질 마진">
            {p.byChannel.length === 0 ? (
              <p className="text-sm text-ink-2">데이터 없음</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {p.byChannel.map((c) => (
                  <li key={c.channel}>
                    <div className="flex justify-between">
                      <span>{CHANNELS.find((x) => x.id === c.channel)?.label}</span>
                      <span className="tabular">
                        매출 {man(c.sales)} · 마진 <b>{c.sales ? pct(c.margin / c.sales, 0) : "-"}</b>
                      </span>
                    </div>
                    <Bar value={c.margin} max={Math.max(...p.byChannel.map((x) => x.sales))} tone="good" />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-ink-2">마진 = 매출 − 부가세 − 수수료 − 원가 − 포장재 (인건비·고정비 제외)</p>
          </Card>

          <Card title="세금 적립 가이드">
            <p className="text-sm">
              이번 달 부가세 예상액 <b className="tabular">{won(p.vat)}</b>
            </p>
            <p className="mt-1 text-xs text-ink-2">
              매입세액 공제 전 금액입니다. 부가세는 1월·7월(일반과세자 확정신고)에 한꺼번에 나가므로 매달 별도 통장에 적립해 두세요. 종합소득세는 순수익의 일정 비율(예: 10~15%)을 함께 모아두는 것을 권장합니다.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
