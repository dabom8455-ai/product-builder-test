"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePayrolls, usePnl, usePnlSeries } from "@/lib/hooks";
import { useApp } from "@/lib/store";
import { addMonths, businessDays, todayLocal } from "@/lib/dates";
import type { Pnl } from "@/lib/domain/pnl";
import { applyScenario, breakEvenVolumeChange, NO_CHANGE, type Scenario } from "@/lib/domain/scenario";
import { purchaseAmount } from "@/lib/domain/usage";
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

      <TrendChart month={month} />

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
                  <p>
                    하루 평균 = 월 손익분기 ÷ 영업일 {businessDays(month, store.closedDays)}일{store.closedDays.length > 0 && " (정기 휴무 제외)"}
                  </p>
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

          <PurchaseCheck month={month} cogs={p.cogs} />

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
      <ScenarioCard p={p} />
    </div>
  );
}

/** 최근 6개월 매출·순수익. 같은 단위(원)라 한 축에 그린다. */
function TrendChart({ month }: { month: string }) {
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)), [month]);
  const all = usePnlSeries(months);
  // 매출 기록이 시작되기 전 달은 고정비만 잡혀 적자로 보이므로 뺀다
  const firstWithSales = all.findIndex((p) => p.grossSales > 0);
  const series = firstWithSales > 0 ? all.slice(firstWithSales) : all;
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((p) => p.grossSales));
  const min = Math.min(0, ...series.map((p) => p.operatingProfit));
  const W = 600;
  const H = 220;
  const padL = 64;
  const padB = 24;
  const padT = 8;
  const plotH = H - padB - padT;
  const y = (v: number) => padT + ((max - v) / (max - min)) * plotH;
  const band = (W - padL) / series.length;
  const barW = Math.min(28, band / 3);
  const ticks = [0, max / 2, max];
  const hasData = series.some((p) => p.grossSales > 0);

  return (
    <Card
      title="최근 6개월 추이"
      right={
        <div className="flex gap-3 text-xs text-ink-2">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-series-1" /> 매출
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-series-2" /> 순수익
          </span>
        </div>
      }
    >
      {!hasData ? (
        <p className="text-sm text-ink-2">최근 6개월 매출 데이터가 없습니다.</p>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="최근 6개월 매출과 순수익 막대 차트" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
                <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--ink-2)">
                  {man(t)}
                </text>
              </g>
            ))}
            {min < 0 && <line x1={padL} x2={W} y1={y(0)} y2={y(0)} stroke="var(--ink-2)" strokeWidth="1" />}
            {series.map((p, i) => {
              const cx = padL + band * i + band / 2;
              const salesTop = y(p.grossSales);
              const profTop = y(Math.max(0, p.operatingProfit));
              const profBottom = y(Math.min(0, p.operatingProfit));
              return (
                <g key={p.month} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${p.month} 매출 ${won(p.grossSales)}, 순수익 ${won(p.operatingProfit)}`}>
                  <rect x={padL + band * i} y={padT} width={band} height={plotH} fill={hover === i ? "var(--surface-2)" : "transparent"} />
                  <rect x={cx - barW - 1} y={salesTop} width={barW} height={Math.max(0, y(0) - salesTop)} rx="4" fill="var(--series-1)" />
                  <rect x={cx + 1} y={profTop} width={barW} height={Math.max(1, profBottom - profTop)} rx="4" fill="var(--series-2)" />
                  <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill={p.month === month ? "var(--ink)" : "var(--ink-2)"} fontWeight={p.month === month ? 700 : 400}>
                    {Number(p.month.slice(5))}월
                  </text>
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow tabular"
              style={{ left: `clamp(0px, calc(${((padL + band * hover + band / 2) / W) * 100}% - 70px), calc(100% - 150px))` }}
            >
              <div className="font-semibold">{series[hover].month}</div>
              <div>매출 {won(series[hover].grossSales)}</div>
              <div>순수익 {won(series[hover].operatingProfit)}</div>
              <div className="text-ink-2">순이익률 {series[hover].grossSales ? pct(series[hover].operatingProfit / series[hover].grossSales) : "-"}</div>
            </div>
          )}
          <details className="mt-2 text-xs text-ink-2">
            <summary className="cursor-pointer">표로 보기</summary>
            <table className="mt-2 w-full tabular">
              <thead>
                <tr>
                  <th className="text-left font-normal">월</th>
                  <th className="text-right font-normal">매출</th>
                  <th className="text-right font-normal">순수익</th>
                  <th className="text-right font-normal">순이익률</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {series.map((p) => (
                  <tr key={p.month}>
                    <td>{p.month}</td>
                    <td className="text-right">{won(p.grossSales)}</td>
                    <td className="text-right">{won(p.operatingProfit)}</td>
                    <td className="text-right">{p.grossSales ? pct(p.operatingProfit / p.grossSales) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
    </Card>
  );
}

function Slider({ id, label, value, min, max, step, format, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <label htmlFor={id} className="text-ink-2">
          {label}
        </label>
        <span className={`font-semibold tabular ${value > 0 ? "text-ink" : value < 0 ? "text-ink" : "text-ink-2"}`}>{format(value)}</span>
      </div>
      <input id={id} type="range" className="mt-1 w-full accent-[var(--brand)]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** 손익 시나리오: 가격·판매량·인건비·고정비를 바꾸면 순수익이 얼마나 변하나 */
function ScenarioCard({ p }: { p: Pnl }) {
  const [sc, setSc] = useState<Scenario>(NO_CHANGE);
  const r = applyScenario(p, sc);
  const bev = sc.pricePct > 0 ? breakEvenVolumeChange(p, sc.pricePct) : null;
  const signedPct = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`;
  const signedWon = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${won(Math.abs(v))}`;
  if (p.grossSales === 0) return null;
  return (
    <Card
      title="손익 시나리오"
      right={
        <Button size="sm" variant="ghost" onClick={() => setSc(NO_CHANGE)} disabled={sc === NO_CHANGE}>
          초기화
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Slider id="sc-price" label="전 메뉴 가격" value={sc.pricePct} min={-0.2} max={0.2} step={0.01} format={signedPct} onChange={(v) => setSc({ ...sc, pricePct: v })} />
          <Slider id="sc-vol" label="판매량" value={sc.volumePct} min={-0.3} max={0.3} step={0.01} format={signedPct} onChange={(v) => setSc({ ...sc, volumePct: v })} />
          <Slider id="sc-labor" label="월 인건비" value={sc.laborDelta} min={-2_000_000} max={2_000_000} step={50_000} format={signedWon} onChange={(v) => setSc({ ...sc, laborDelta: v })} />
          <Slider id="sc-fixed" label="월 고정비 (임대료 등)" value={sc.fixedDelta} min={-1_000_000} max={1_000_000} step={50_000} format={signedWon} onChange={(v) => setSc({ ...sc, fixedDelta: v })} />
        </div>
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="text-xs text-ink-2">{p.month} 기준 순수익</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tabular">{won(r.operatingProfit)}</span>
            <span className={`text-sm font-semibold tabular ${r.delta > 0 ? "text-good" : r.delta < 0 ? "text-bad" : "text-ink-2"}`}>
              {r.delta === 0 ? "변화 없음" : `${signedWon(r.delta)} (${r.delta > 0 ? "▲" : "▼"})`}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular">
            <dt className="text-ink-2">매출</dt>
            <dd className="text-right">{won(r.grossSales)}</dd>
            <dt className="text-ink-2">재료원가</dt>
            <dd className="text-right">{won(r.cogs)}</dd>
            <dt className="text-ink-2">수수료</dt>
            <dd className="text-right">{won(r.fees)}</dd>
            <dt className="text-ink-2">인건비</dt>
            <dd className="text-right">{won(r.labor)}</dd>
            <dt className="text-ink-2">고정비</dt>
            <dd className="text-right">{won(r.fixed)}</dd>
          </dl>
          {bev !== null && (
            <p className="mt-3 text-xs">
              가격을 {signedPct(sc.pricePct)} 올리면 판매량이 <b>{Math.abs(bev * 100).toFixed(1)}%</b> 줄어도 지금과 같은 이익입니다.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/** 실제 매입액과 레시피 기준 원가 비교 */
function PurchaseCheck({ month, cogs }: { month: string; cogs: number }) {
  const purchases = useApp((s) => s.purchases);
  const bought = purchases.filter((x) => x.date.startsWith(month)).reduce((t, x) => t + purchaseAmount(x), 0);
  if (bought === 0) return null;
  const diff = bought - cogs;
  return (
    <Card title="실제 매입 vs 레시피 원가" right={<Link href="/menu" className="text-sm text-brand">재료별 보기 →</Link>}>
      <dl className="grid grid-cols-2 gap-y-1 text-sm tabular">
        <dt>실제 매입액</dt>
        <dd className="text-right">{won(bought)}</dd>
        <dt>레시피 기준 원가</dt>
        <dd className="text-right">{won(cogs)}</dd>
        <dt className="font-semibold">차이</dt>
        <dd className={`text-right font-semibold ${diff > 0 ? "text-bad" : "text-good"}`}>
          {diff > 0 ? "+" : ""}
          {won(diff)} ({cogs ? pct(diff / cogs) : "-"})
        </dd>
      </dl>
      <p className="mt-2 text-[11px] text-ink-2">손익표의 재료원가는 레시피 기준입니다. 매입이 더 많으면 로스·재고 증가, 적으면 재고 소진입니다.</p>
    </Card>
  );
}

