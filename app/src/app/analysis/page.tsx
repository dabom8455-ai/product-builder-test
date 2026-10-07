"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMenuAnalysis } from "@/lib/hooks";
import { newId, useApp, useMaps } from "@/lib/store";
import { QUADRANT_INFO, type MenuStat, type Quadrant, type Suggestion } from "@/lib/domain/menuEngineering";
import { linePrice } from "@/lib/domain/pnl";
import { addDays, todayLocal } from "@/lib/dates";
import { Badge, Button, Card, Empty, PageHeader, Segmented } from "@/components/ui";
import { num, pct, won } from "@/lib/format";
import { askConfirm } from "@/components/Confirm";

const COLORS: Record<Quadrant, string> = { star: "#d4a017", plowhorse: "#8a6d55", puzzle: "#2f7d9a", dog: "#a0a0a0" };

export default function AnalysisPage() {
  const [days, setDays] = useState<"28" | "56" | "84">("56");
  const a = useMenuAnalysis(Number(days));

  return (
    <div className="space-y-5">
      <PageHeader
        title="메뉴 분석"
        desc="판매량 × 개당 마진으로 메뉴를 네 그룹으로 나누고, 무엇을 밀고·고치고·뺄지 제안합니다."
        right={
          <Segmented
            value={days}
            onChange={setDays}
            options={[
              { id: "28", label: "4주" },
              { id: "56", label: "8주" },
              { id: "84", label: "12주" },
            ]}
          />
        }
      />
      {a.stats.every((s) => s.qty === 0) ? (
        <Empty>
          분석할 판매 데이터가 없습니다.{" "}
          <Link className="underline" href="/sales">
            매출 입력
          </Link>
          에서 판매 수량을 넣어 주세요.
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Card title="메뉴 엔지니어링 매트릭스">
              <Matrix stats={a.stats} mixThreshold={a.mixThreshold} avgMargin={a.avgMargin} />
              <p className="mt-2 text-[11px] text-ink-2">
                가로: 판매 비중 (기준선 {pct(a.mixThreshold)} = 1/메뉴수 × 70%) · 세로: 개당 공헌이익 (기준선 = 가중평균 {won(a.avgMargin)})
              </p>
            </Card>
            <Card title="제안" className="lg:max-h-[640px] lg:overflow-y-auto">
              <Suggestions suggestions={a.suggestions} stats={a.stats} />
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(Object.keys(QUADRANT_INFO) as Quadrant[]).map((q) => (
              <Card
                key={q}
                title={
                  <span>
                    {QUADRANT_INFO[q].emoji} {QUADRANT_INFO[q].label}
                  </span>
                }
                right={<span className="text-xs text-ink-2">{QUADRANT_INFO[q].desc}</span>}
              >
                <StatTable stats={a.stats.filter((s) => s.quadrant === q)} />
              </Card>
            ))}
          </div>
          <EffectTracker />
        </>
      )}
    </div>
  );
}

function Matrix({ stats, mixThreshold, avgMargin }: { stats: MenuStat[]; mixThreshold: number; avgMargin: number }) {
  const W = 520;
  const H = 340;
  const pad = 36;
  const maxX = Math.max(...stats.map((s) => s.mixShare), mixThreshold) * 1.1;
  const minY = Math.min(0, ...stats.map((s) => s.unitMargin));
  const maxY = Math.max(...stats.map((s) => s.unitMargin), avgMargin) * 1.1;
  const x = (v: number) => pad + (v / maxX) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - minY) / (maxY - minY || 1)) * (H - pad * 2);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="메뉴 매트릭스">
        <rect x={x(mixThreshold)} y={pad} width={W - pad - x(mixThreshold)} height={y(avgMargin) - pad} fill="#d4a017" opacity="0.08" />
        <rect x={pad} y={y(avgMargin)} width={x(mixThreshold) - pad} height={H - pad - y(avgMargin)} fill="#888" opacity="0.08" />
        <line x1={x(mixThreshold)} x2={x(mixThreshold)} y1={pad} y2={H - pad} stroke="currentColor" strokeDasharray="4 4" opacity="0.4" />
        <line x1={pad} x2={W - pad} y1={y(avgMargin)} y2={y(avgMargin)} stroke="currentColor" strokeDasharray="4 4" opacity="0.4" />
        <text x={W - pad} y={pad - 8} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">
          ⭐ Star
        </text>
        <text x={pad} y={pad - 8} fontSize="11" fill="currentColor" opacity="0.6">
          🧩 Puzzle
        </text>
        <text x={W - pad} y={H - 8} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">
          🐴 Plowhorse
        </text>
        <text x={pad} y={H - 8} fontSize="11" fill="currentColor" opacity="0.6">
          🐶 Dog
        </text>
        {stats.map((s, i) => (
          <g key={s.menu.id}>
            <circle cx={x(s.mixShare)} cy={y(s.unitMargin)} r={10} fill={COLORS[s.quadrant]} opacity="0.9" />
            <text x={x(s.mixShare)} y={y(s.unitMargin) + 4} fontSize="11" fontWeight="700" textAnchor="middle" fill="#fff">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <ol className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
        {stats.map((s, i) => (
          <li key={s.menu.id} className="flex items-center gap-1.5">
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: COLORS[s.quadrant] }}
            >
              {i + 1}
            </span>
            <span className="truncate">{s.menu.name}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function StatTable({ stats }: { stats: MenuStat[] }) {
  if (stats.length === 0) return <p className="text-sm text-ink-2">해당 메뉴 없음</p>;
  return (
    <table className="w-full text-sm tabular">
      <thead className="text-xs text-ink-2">
        <tr>
          <th className="text-left font-normal">메뉴</th>
          <th className="text-right font-normal">판매</th>
          <th className="text-right font-normal">개당 마진</th>
          <th className="text-right font-normal">총 마진</th>
          <th className="text-right font-normal">추세</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s) => (
          <tr key={s.menu.id} className="border-t border-line/60">
            <td className="py-1.5">
              {s.menu.name}
              {s.negativeReviews > 0 && (
                <span className="ml-1">
                  <Badge tone="bad">부정 {s.negativeReviews}</Badge>
                </span>
              )}
            </td>
            <td className="text-right">{num(s.qty)}</td>
            <td className="text-right">{won(s.unitMargin)}</td>
            <td className="text-right">{won(s.totalMargin)}</td>
            <td className={`text-right text-xs ${s.trend > 0.05 ? "text-good" : s.trend < -0.05 ? "text-bad" : "text-ink-2"}`}>
              {s.trend > 0 ? "▲" : s.trend < 0 ? "▼" : ""}
              {pct(Math.abs(s.trend), 0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Suggestions({ suggestions, stats }: { suggestions: Suggestion[]; stats: MenuStat[] }) {
  const upsert = useApp((s) => s.upsert);
  const actions = useApp((s) => s.actions);
  const log = (menuId: string, action: string) => upsert("actions", { id: newId("act"), menuId, action, appliedAt: todayLocal() });
  const done = (menuId: string) => actions.some((a) => a.menuId === menuId && a.appliedAt >= addDays(todayLocal(), -14));

  return (
    <ul className="space-y-4">
      {suggestions.map((s) => {
        const stat = stats.find((x) => x.menu.id === s.menuId)!;
        const menu = stat.menu;
        return (
          <li key={s.menuId + s.action} className="text-sm">
            <div className="font-medium">
              {QUADRANT_INFO[s.quadrant].emoji} {s.title}
            </div>
            <p className="text-xs text-ink-2">{s.detail}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {done(s.menuId) && <Badge tone="good">최근 실행됨</Badge>}
              {s.action === "reprice" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!(await askConfirm(`${menu.name} 가격을 ${won(menu.price)} → ${won(menu.price + 300)}(배달 ${won(menu.deliveryPrice + 300)})으로 올릴까요?`, { confirmLabel: "인상 적용" })))
                      return;
                    upsert("menus", { ...menu, price: menu.price + 300, deliveryPrice: menu.deliveryPrice + 300 });
                    log(menu.id, `가격 300원 인상 (${won(menu.price)} → ${won(menu.price + 300)})`);
                  }}
                >
                  300원 인상 적용
                </Button>
              )}
              {s.action === "promote" && (
                <Link href={`/poster?menu=${menu.id}`} onClick={() => log(menu.id, "홍보 포스터 제작")}>
                  <Button size="sm" variant="ghost">
                    포스터 만들기
                  </Button>
                </Link>
              )}
              {s.action === "drop" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!(await askConfirm(`${menu.name}을(를) 판매중지할까요? 메뉴·원가에서 다시 켤 수 있습니다.`, { confirmLabel: "판매중지" }))) return;
                    upsert("menus", { ...menu, active: false });
                    log(menu.id, "판매중지");
                  }}
                >
                  판매중지
                </Button>
              )}
              {s.action === "fix" && (
                <>
                  <Link href="/reviews">
                    <Button size="sm" variant="ghost">
                      리뷰 보기
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => log(menu.id, "레시피·품질 개선")}>
                    개선 완료 기록
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** 실행한 조정의 효과를 전후 14일로 비교해 의사결정 루프를 닫는다 */
function EffectTracker() {
  const actions = useApp((s) => s.actions);
  const sales = useApp((s) => s.sales);
  const remove = useApp((s) => s.remove);
  const { menuMap } = useMaps();

  const rows = useMemo(
    () =>
      [...actions]
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
        .map((act) => {
          const menu = menuMap.get(act.menuId);
          const before = { from: addDays(act.appliedAt, -14), to: act.appliedAt };
          const after = { from: act.appliedAt, to: addDays(act.appliedAt, 14) };
          const today = todayLocal();
          const daysAfter = Math.max(0, Math.min(14, (Date.parse(today) - Date.parse(act.appliedAt)) / 864e5));
          const sum = (r: { from: string; to: string }) => {
            let qty = 0;
            let rev = 0;
            for (const l of sales) {
              if (l.menuId !== act.menuId || l.date < r.from || l.date >= r.to || !menu) continue;
              qty += l.qty;
              rev += linePrice(menu, l.channel) * l.qty;
            }
            return { qty, rev };
          };
          const b = sum(before);
          const a = sum(after);
          return { act, menu, b, a, daysAfter };
        }),
    [actions, sales, menuMap],
  );

  return (
    <Card title="조정 효과 추적 (실행 전후 14일 비교)">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-2">위 제안에서 조정을 실행하면 여기에서 전후 판매 변화를 추적합니다.</p>
      ) : (
        <table className="w-full text-sm tabular">
          <thead className="text-xs text-ink-2">
            <tr>
              <th className="text-left font-normal">실행일</th>
              <th className="text-left font-normal">메뉴 · 조치</th>
              <th className="text-right font-normal">일평균 판매 전→후</th>
              <th className="text-right font-normal">일평균 매출 전→후</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ act, menu, b, a, daysAfter }) => (
              <tr key={act.id} className="border-t border-line/60">
                <td className="py-1.5">{act.appliedAt.slice(5)}</td>
                <td>
                  {menu?.name ?? "(삭제된 메뉴)"} · <span className="text-ink-2">{act.action}</span>
                </td>
                <td className="text-right">
                  {num(b.qty / 14, 1)} → {daysAfter > 0 ? num(a.qty / daysAfter, 1) : "측정 중"}
                </td>
                <td className="text-right">
                  {won(b.rev / 14)} → {daysAfter > 0 ? won(a.rev / daysAfter) : "측정 중"}
                </td>
                <td className="text-right">
                  <button className="text-ink-2 hover:text-bad" aria-label="기록 삭제" onClick={() => remove("actions", act.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
