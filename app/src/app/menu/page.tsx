"use client";

import { useMemo, useState } from "react";
import { newId, useApp, useMaps } from "@/lib/store";
import type { Ingredient, Menu, MenuCategory, Purchase, PurchaseItem } from "@/lib/types";
import { CHANNELS } from "@/lib/types";
import { costRatio, menuCost, priceForTargetRatio, unitCost, unitMargin } from "@/lib/domain/cost";
import { Badge, Button, Card, Empty, Explain, Field, NumInput, PageHeader, Segmented, ic, inputCls } from "@/components/ui";
import { num, pct, won } from "@/lib/format";
import { addDays, addMonths, todayLocal } from "@/lib/dates";
import { lossReport, purchaseAmount } from "@/lib/domain/usage";
import { askConfirm } from "@/components/Confirm";

type Tab = "menus" | "ingredients" | "purchases" | "simulate";

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>("menus");
  return (
    <div>
      <PageHeader
        title="메뉴·원가"
        desc="재료 단가와 레시피를 한 번 등록하면 원가율·마진·메뉴 분석·포스터 가격이 모두 자동으로 반영됩니다."
        right={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: "menus", label: "메뉴·레시피" },
              { id: "ingredients", label: "재료 단가" },
              { id: "purchases", label: "매입·로스" },
              { id: "simulate", label: "단가 변동 시뮬" },
            ]}
          />
        }
      />
      {tab === "menus" && <MenusTab />}
      {tab === "ingredients" && <IngredientsTab />}
      {tab === "purchases" && <PurchasesTab />}
      {tab === "simulate" && <SimulateTab />}
    </div>
  );
}

function targetOf(category: MenuCategory, t: { drink: number; dessert: number }) {
  return category === "drink" ? t.drink : t.dessert;
}

function MenusTab() {
  const menus = useApp((s) => s.menus);
  const store = useApp((s) => s.store);
  const upsert = useApp((s) => s.upsert);
  const { unitCosts } = useMaps();
  const [filter, setFilter] = useState<"all" | MenuCategory | "sub">("all");
  const [editing, setEditing] = useState<string | null>(null);

  const list = menus.filter((m) => (filter === "sub" ? m.isSub : !m.isSub && (filter === "all" || m.category === filter)));

  const addMenu = (isSub: boolean) => {
    const m: Menu = {
      id: newId(isSub ? "s" : "m"),
      name: isSub ? "새 서브레시피" : "새 메뉴",
      category: "drink",
      price: isSub ? 0 : 5000,
      deliveryPrice: isSub ? 0 : 5500,
      isSub,
      yieldQty: isSub ? 1000 : 1,
      yieldUnit: isSub ? "ml" : "개",
      recipe: [],
      lossRate: 0.03,
      active: true,
    };
    upsert("menus", m);
    setEditing(m.id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card
        title="메뉴 목록"
        right={
          <div className="flex gap-1">
            <Button size="sm" onClick={() => addMenu(false)}>
              + 메뉴
            </Button>
            <Button size="sm" variant="ghost" onClick={() => addMenu(true)}>
              + 서브레시피
            </Button>
          </div>
        }
      >
        <div className="mb-3">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "전체" },
              { id: "drink", label: "음료" },
              { id: "dessert", label: "디저트" },
              { id: "sub", label: "서브레시피" },
            ]}
          />
        </div>
        {list.length === 0 ? (
          <Empty>메뉴를 추가해 주세요.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((m) => {
              const cost = unitCosts.get(m.id) ?? 0;
              const ratio = costRatio(cost, m.price);
              const over = !m.isSub && ratio > targetOf(m.category, store.targetCostRatio);
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setEditing(m.id)}
                    className={`flex w-full items-center justify-between gap-2 px-1 py-2.5 text-left ${editing === m.id ? "bg-surface-2 rounded-lg" : ""}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {m.name} {!m.active && <Badge>판매중지</Badge>}
                      </div>
                      <div className="text-xs text-ink-2 tabular">
                        {m.isSub ? `${num(m.yieldQty)}${m.yieldUnit} 생산 · ${won(cost)}` : `${won(m.price)} · 원가 ${won(cost)}`}
                      </div>
                    </div>
                    {!m.isSub && <Badge tone={over ? "bad" : "good"}>{pct(ratio)}</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {editing && menus.find((m) => m.id === editing) ? (
        <MenuEditor
          key={editing}
          menu={menus.find((m) => m.id === editing)!}
          onClose={() => setEditing(null)}
          onDuplicate={(m) => {
            const copy: Menu = { ...m, id: newId(m.isSub ? "s" : "m"), name: `${m.name} (복사)`, recipe: m.recipe.map((r) => ({ ...r })) };
            upsert("menus", copy);
            setEditing(copy.id);
          }}
        />
      ) : (
        <Empty>왼쪽에서 메뉴를 선택하면 레시피와 원가를 편집할 수 있습니다.</Empty>
      )}
    </div>
  );
}

function MenuEditor({ menu, onClose, onDuplicate }: { menu: Menu; onClose: () => void; onDuplicate: (m: Menu) => void }) {
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const ingredients = useApp((s) => s.ingredients);
  const menus = useApp((s) => s.menus);
  const store = useApp((s) => s.store);
  const { ingMap, menuMap } = useMaps();
  const save = (patch: Partial<Menu>) => upsert("menus", { ...menu, ...patch });
  const { total, lines } = menuCost(menu, ingMap, menuMap);
  const target = targetOf(menu.category, store.targetCostRatio);
  const [simTarget, setSimTarget] = useState(target);
  const subs = menus.filter((m) => m.isSub && m.id !== menu.id);

  const setItem = (i: number, patch: Partial<Menu["recipe"][number]>) =>
    save({ recipe: menu.recipe.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <Card
      title={menu.isSub ? "서브레시피 편집" : "메뉴 편집"}
      right={
        <Button size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="이름">
          <input className={inputCls} value={menu.name} onChange={(e) => save({ name: e.target.value })} />
        </Field>
        <Field label="분류">
          <select className={inputCls} value={menu.category} onChange={(e) => save({ category: e.target.value as MenuCategory })}>
            <option value="drink">음료</option>
            <option value="dessert">디저트</option>
          </select>
        </Field>
        {menu.isSub ? (
          <>
            <Field label="생산량">
              <NumInput value={menu.yieldQty} onChange={(n) => save({ yieldQty: n })} />
            </Field>
            <Field label="생산 단위">
              <input className={inputCls} value={menu.yieldUnit} onChange={(e) => save({ yieldUnit: e.target.value })} />
            </Field>
          </>
        ) : (
          <>
            <Field label="매장 판매가">
              <NumInput value={menu.price} step={100} onChange={(n) => save({ price: n })} />
            </Field>
            <Field label="배달 판매가">
              <NumInput value={menu.deliveryPrice} step={100} onChange={(n) => save({ deliveryPrice: n })} />
            </Field>
          </>
        )}
        <Field label="로스율(%)" hint="버려지는 양·시음 등">
          <NumInput value={Math.round(menu.lossRate * 1000) / 10} step={0.5} onChange={(n) => save({ lossRate: n / 100 })} />
        </Field>
        {!menu.isSub && (
          <Field label="판매 상태">
            <select className={inputCls} value={menu.active ? "1" : "0"} onChange={(e) => save({ active: e.target.value === "1" })}>
              <option value="1">판매중</option>
              <option value="0">판매중지</option>
            </select>
          </Field>
        )}
        {!menu.isSub && (
          <div className="col-span-2">
            <Field label="한 줄 소개 (포스터·AI 카피에 사용)">
              <input className={inputCls} value={menu.description ?? ""} onChange={(e) => save({ description: e.target.value })} />
            </Field>
          </div>
        )}
      </div>

      <h3 className="mt-5 mb-2 text-sm font-semibold">레시피</h3>
      <div className="space-y-2">
        {menu.recipe.map((r, i) => {
          const unit = r.kind === "ingredient" ? ingMap.get(r.refId)?.unit : menuMap.get(r.refId)?.yieldUnit;
          return (
            <div key={i} className="flex items-center gap-2">
              <select
                className={ic("flex-1")}
                value={`${r.kind}:${r.refId}`}
                onChange={(e) => {
                  const [kind, refId] = e.target.value.split(":");
                  setItem(i, { kind: kind as "ingredient" | "sub", refId });
                }}
              >
                <optgroup label="재료">
                  {ingredients.map((g) => (
                    <option key={g.id} value={`ingredient:${g.id}`}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
                {subs.length > 0 && (
                  <optgroup label="서브레시피">
                    {subs.map((s) => (
                      <option key={s.id} value={`sub:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <NumInput className="w-24" value={r.qty} step={1} onChange={(n) => setItem(i, { qty: n })} aria-label="사용량" />
              <span className="w-8 text-xs text-ink-2">{unit}</span>
              <span className="w-16 text-right text-xs tabular">{won(lines[i]?.cost ?? 0)}</span>
              <button className="text-ink-2 hover:text-bad" aria-label="삭제" onClick={() => save({ recipe: menu.recipe.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          disabled={ingredients.length === 0}
          onClick={() => save({ recipe: [...menu.recipe, { kind: "ingredient", refId: ingredients[0].id, qty: 1 }] })}
        >
          + 재료 추가
        </Button>
      </div>

      <div className="mt-5 rounded-xl bg-surface-2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm">{menu.isSub ? `원가 (${num(menu.yieldQty)}${menu.yieldUnit} 기준)` : "1개 원가"}</span>
          <span className="text-xl font-bold tabular">{won(total)}</span>
        </div>
        {menu.isSub ? (
          <p className="mt-1 text-xs text-ink-2">
            {menu.yieldUnit}당 {won(menu.yieldQty > 0 ? total / menu.yieldQty : 0)}
          </p>
        ) : (
          <>
            <div className="mt-1 flex items-baseline justify-between text-sm">
              <span>원가율</span>
              <span className={`font-semibold tabular ${costRatio(total, menu.price) > target ? "text-bad" : "text-good"}`}>
                {pct(costRatio(total, menu.price))} <span className="text-xs text-ink-2">(목표 {pct(target, 0)})</span>
              </span>
            </div>
            <table className="mt-3 w-full text-xs tabular">
              <thead className="text-ink-2">
                <tr>
                  <th className="text-left font-normal">채널</th>
                  <th className="text-right font-normal">판매가</th>
                  <th className="text-right font-normal">수수료</th>
                  <th className="text-right font-normal">1개 순마진</th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((c) => {
                  const price = c.delivery ? menu.deliveryPrice || menu.price : menu.price;
                  const r = unitMargin(price, total, store.channelFeeRate[c.id], c.delivery ? store.deliveryPackagingCost : 0, store.vatMode);
                  return (
                    <tr key={c.id}>
                      <td>{c.label}</td>
                      <td className="text-right">{won(price)}</td>
                      <td className="text-right">{won(r.fee)}</td>
                      <td className={`text-right font-semibold ${r.margin < 0 ? "text-bad" : ""}`}>
                        {won(r.margin)} ({pct(r.marginRate, 0)})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Explain>
              <p>순마진 = 판매가 − 부가세 − 채널 수수료 − 배달 포장재 − 원가</p>
              {lines.map((l, i) => (
                <p key={i}>
                  · {l.name} {num(l.qty, 2)}
                  {l.unit} = {won(l.cost)}
                </p>
              ))}
              <p>· 로스율 {pct(menu.lossRate)} 가산</p>
            </Explain>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span>목표 원가율</span>
              <NumInput className="w-20" value={Math.round(simTarget * 100)} onChange={(n) => setSimTarget(n / 100)} aria-label="목표 원가율" />
              <span>% 이면 권장가</span>
              <b className="tabular">{won(priceForTargetRatio(total, simTarget))}</b>
              {priceForTargetRatio(total, simTarget) !== menu.price && (
                <Button size="sm" variant="ghost" onClick={() => save({ price: priceForTargetRatio(total, simTarget) })}>
                  적용
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDuplicate(menu)}>
          복제
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={async () => {
            if (await askConfirm(`${menu.name}을(를) 삭제할까요? 판매 기록의 원가 계산에서도 빠집니다.`, { confirmLabel: "삭제", danger: true })) {
              remove("menus", menu.id);
              onClose();
            }
          }}
        >
          삭제
        </Button>
      </div>
    </Card>
  );
}

function IngredientsTab() {
  const ingredients = useApp((s) => s.ingredients);
  const history = useApp((s) => s.priceHistory);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const updatePrice = useApp((s) => s.updateIngredientPrice);
  const menus = useApp((s) => s.menus);

  const prevPrice = (id: string, current: number) => {
    const rows = history.filter((h) => h.ingredientId === id).sort((a, b) => a.date.localeCompare(b.date));
    const before = rows.filter((r) => r.packPrice !== current).pop();
    return before?.packPrice;
  };

  const add = () => {
    const i: Ingredient = { id: newId("i"), name: "새 재료", unit: "g", packSize: 1000, packPrice: 0, updatedAt: todayLocal() };
    upsert("ingredients", i);
  };

  return (
    <Card title={`재료 ${ingredients.length}개`} right={<Button size="sm" onClick={add}>+ 재료</Button>}>
      <p className="mb-3 text-xs text-ink-2">매입가를 바꾸면 단가 이력이 남고, 이 재료를 쓰는 모든 메뉴의 원가가 즉시 다시 계산됩니다.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-ink-2">
            <tr className="border-b border-line">
              <th className="py-2 text-left font-normal">재료</th>
              <th className="text-left font-normal">단위</th>
              <th className="text-right font-normal">포장 용량</th>
              <th className="text-right font-normal">매입가</th>
              <th className="text-right font-normal">단위 원가</th>
              <th className="text-right font-normal">변동</th>
              <th className="text-right font-normal">사용 메뉴</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ingredients.map((i) => {
              const prev = prevPrice(i.id, i.packPrice);
              const change = prev ? (i.packPrice - prev) / prev : 0;
              const used = menus.filter((m) => m.recipe.some((r) => r.kind === "ingredient" && r.refId === i.id)).length;
              return (
                <tr key={i.id} className="border-b border-line/60">
                  <td className="py-1.5 pr-2">
                    <input className={ic("py-1")} value={i.name} onChange={(e) => upsert("ingredients", { ...i, name: e.target.value })} />
                  </td>
                  <td className="pr-2">
                    <input className={ic("w-16 py-1")} value={i.unit} onChange={(e) => upsert("ingredients", { ...i, unit: e.target.value })} />
                  </td>
                  <td className="pr-2">
                    <NumInput className="w-24 py-1 text-right" value={i.packSize} onChange={(n) => upsert("ingredients", { ...i, packSize: n })} />
                  </td>
                  <td className="pr-2">
                    <PriceInput value={i.packPrice} onCommit={(n) => updatePrice(i.id, n)} />
                  </td>
                  <td className="text-right tabular">{num(unitCost(i), 2)}원</td>
                  <td className="text-right text-xs">
                    {prev ? <Badge tone={change > 0 ? "bad" : "good"}>{change > 0 ? "▲" : "▼"} {pct(Math.abs(change), 0)}</Badge> : "-"}
                  </td>
                  <td className="text-right tabular">{used}</td>
                  <td className="pl-2 text-right">
                    <button
                      className="text-ink-2 hover:text-bad"
                      aria-label="삭제"
                      onClick={async () => {
                        const msg = used > 0 ? `${i.name}은(는) ${used}개 메뉴의 레시피에서 쓰고 있습니다. 삭제할까요?` : `${i.name}을(를) 삭제할까요?`;
                        if (await askConfirm(msg, { confirmLabel: "삭제", danger: true })) remove("ingredients", i.id);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** 매입가는 입력 중이 아니라 확정(blur/Enter) 시에만 반영해서 이력이 글자마다 쌓이지 않게 한다 */
function PriceInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setDraft(String(value));
  };
  return (
    <input
      type="number"
      className={ic("w-28 py-1 text-right tabular")}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function SimulateTab() {
  const ingredients = useApp((s) => s.ingredients);
  const menus = useApp((s) => s.menus);
  const sales = useApp((s) => s.sales);
  const { ingMap, menuMap, unitCosts } = useMaps();
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? "");
  const [change, setChange] = useState(10);

  const result = useMemo(() => {
    const ing = ingMap.get(ingId);
    if (!ing) return [];
    const changed = new Map(ingMap);
    changed.set(ing.id, { ...ing, packPrice: ing.packPrice * (1 + change / 100) });
    const from = addDays(todayLocal(), -30);
    const qty30 = new Map<string, number>();
    for (const l of sales) if (l.date >= from) qty30.set(l.menuId, (qty30.get(l.menuId) ?? 0) + l.qty);
    return menus
      .filter((m) => !m.isSub)
      .map((m) => {
        const before = unitCosts.get(m.id) ?? 0;
        const after = menuCost(m, changed, menuMap).total;
        return { m, before, after, monthly: (after - before) * (qty30.get(m.id) ?? 0) };
      })
      .filter((r) => Math.abs(r.after - r.before) > 0.01)
      .sort((a, b) => b.monthly - a.monthly);
  }, [ingId, change, ingMap, menuMap, menus, sales, unitCosts]);

  const totalMonthly = result.reduce((t, r) => t + r.monthly, 0);

  return (
    <Card title="재료 단가가 바뀌면 마진은 얼마나 줄어들까?">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="재료">
          <select className={inputCls} value={ingId} onChange={(e) => setIngId(e.target.value)}>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="단가 변동(%)">
          <NumInput className="w-24" value={change} onChange={setChange} />
        </Field>
      </div>
      {result.length === 0 ? (
        <p className="mt-4 text-sm text-ink-2">이 재료를 쓰는 판매 메뉴가 없습니다.</p>
      ) : (
        <>
          <p className="mt-4 text-sm">
            최근 30일 판매량 기준 월 이익 변화: <b className={totalMonthly > 0 ? "text-bad" : "text-good"}>{totalMonthly > 0 ? "−" : "+"}{won(Math.abs(totalMonthly))}</b>
          </p>
          <table className="mt-3 w-full text-sm tabular">
            <thead className="text-xs text-ink-2">
              <tr>
                <th className="text-left font-normal">메뉴</th>
                <th className="text-right font-normal">원가 전</th>
                <th className="text-right font-normal">원가 후</th>
                <th className="text-right font-normal">원가율 후</th>
                <th className="text-right font-normal">월 영향</th>
              </tr>
            </thead>
            <tbody>
              {result.map((r) => (
                <tr key={r.m.id} className="border-t border-line/60">
                  <td className="py-1.5">{r.m.name}</td>
                  <td className="text-right">{won(r.before)}</td>
                  <td className="text-right">{won(r.after)}</td>
                  <td className="text-right">{pct(costRatio(r.after, r.m.price))}</td>
                  <td className="text-right">{won(-r.monthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

/** 매입 영수증 기록 + 레시피 기준 사용량과 비교한 로스 분석 */
function PurchasesTab() {
  const purchases = useApp((s) => s.purchases);
  const sales = useApp((s) => s.sales);
  const remove = useApp((s) => s.remove);
  const { ingMap, menuMap, unitCosts } = useMaps();
  const [month, setMonth] = useState(addMonths(todayLocal().slice(0, 7), -1));
  const [editing, setEditing] = useState<Purchase | null>(null);

  const monthPurchases = purchases.filter((p) => p.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));
  const monthSales = useMemo(() => sales.filter((l) => l.date.startsWith(month)), [sales, month]);
  const rows = useMemo(() => lossReport({ sales: monthSales, purchases: monthPurchases, menus: menuMap, ingredients: ingMap }), [monthSales, monthPurchases, menuMap, ingMap]);
  const bought = monthPurchases.reduce((t, p) => t + purchaseAmount(p), 0);
  const theoretical = monthSales.reduce((t, l) => t + (unitCosts.get(l.menuId) ?? 0) * l.qty, 0);
  const lossCost = rows.reduce((t, r) => t + Math.max(0, r.diffCost), 0);

  const newPurchase = (): Purchase => ({ id: newId("pu"), date: todayLocal(), items: [], memo: "" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="이전 달">
          ◀
        </Button>
        <span className="w-20 text-center font-semibold tabular">{month}</span>
        <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">
          ▶
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => setEditing(newPurchase())}>
          + 매입 기록
        </Button>
      </div>

      {editing && <PurchaseEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} />}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-xs text-ink-2">실제 매입액</div>
          <div className="mt-1 text-lg font-bold tabular">{won(bought)}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-xs text-ink-2">레시피 기준 원가</div>
          <div className="mt-1 text-lg font-bold tabular">{won(theoretical)}</div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-xs text-ink-2">추정 로스(초과 매입)</div>
          <div className={`mt-1 text-lg font-bold tabular ${lossCost > 0 ? "text-bad" : ""}`}>{won(lossCost)}</div>
        </div>
      </div>

      <Card title="재료별 로스 분석">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-2">이 달 매입 기록이 없습니다. 영수증을 기록하면 레시피대로 쓰였는지 비교할 수 있습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm tabular">
              <thead className="text-xs text-ink-2">
                <tr>
                  <th className="text-left font-normal">재료</th>
                  <th className="text-right font-normal">레시피 사용량</th>
                  <th className="text-right font-normal">매입량</th>
                  <th className="text-right font-normal">차이</th>
                  <th className="text-right font-normal">차이율</th>
                  <th className="text-right font-normal">금액</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ingredient.id} className="border-t border-line/60">
                    <td className="py-1.5">{r.ingredient.name}</td>
                    <td className="text-right">
                      {num(r.used)}
                      {r.ingredient.unit}
                    </td>
                    <td className="text-right">
                      {num(r.purchased)}
                      {r.ingredient.unit}
                    </td>
                    <td className="text-right">
                      {r.diff > 0 ? "+" : ""}
                      {num(r.diff)}
                      {r.ingredient.unit}
                    </td>
                    <td className="text-right">
                      <Badge tone={r.diffRate > 0.1 ? "bad" : r.diffRate > 0.05 ? "warn" : "good"}>{pct(r.diffRate, 0)}</Badge>
                    </td>
                    <td className={`text-right ${r.diffCost > 0 ? "text-bad" : ""}`}>{won(r.diffCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-ink-2">
          차이 = 매입량 − (판매수량 × 레시피, 로스율 포함). 월초·월말 재고 차이는 반영하지 않으므로 2~3개월 추세로 보세요. 10%를 넘는 재료는 계량·폐기·레시피 준수를 점검하세요.
        </p>
      </Card>

      <Card title={`매입 기록 ${monthPurchases.length}건`}>
        {monthPurchases.length === 0 ? (
          <p className="text-sm text-ink-2">기록 없음</p>
        ) : (
          <ul className="divide-y divide-line">
            {monthPurchases.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {p.date} · {won(purchaseAmount(p))}
                  </div>
                  <div className="truncate text-xs text-ink-2">
                    {p.items.map((it) => `${ingMap.get(it.ingredientId)?.name ?? "?"} ${it.packs}개`).join(", ")}
                    {p.memo && ` · ${p.memo}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    수정
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => (await askConfirm(`${p.date} 매입 기록을 삭제할까요? 재료 단가는 바뀌지 않습니다.`, { confirmLabel: "삭제", danger: true })) && remove("purchases", p.id)}
                  >
                    삭제
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PurchaseEditor({ initial, onClose }: { initial: Purchase; onClose: () => void }) {
  const ingredients = useApp((s) => s.ingredients);
  const savePurchase = useApp((s) => s.savePurchase);
  const [p, setP] = useState<Purchase>(initial);
  const setItem = (i: number, patch: Partial<PurchaseItem>) => setP({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const addItem = () => {
    const ing = ingredients.find((g) => !p.items.some((it) => it.ingredientId === g.id)) ?? ingredients[0];
    if (ing) setP({ ...p, items: [...p.items, { ingredientId: ing.id, packs: 1, packPrice: ing.packPrice }] });
  };
  const valid = p.items.length > 0 && p.items.every((it) => it.packs > 0 && it.packPrice >= 0);

  return (
    <Card title={initial.items.length ? "매입 수정" : "새 매입 (영수증 1장)"} right={<Button size="sm" variant="ghost" onClick={onClose}>닫기</Button>}>
      <div className="flex flex-wrap gap-3">
        <Field label="날짜">
          <input type="date" className={ic("w-44")} value={p.date} onChange={(e) => e.target.value && setP({ ...p, date: e.target.value })} />
        </Field>
        <div className="min-w-48 flex-1">
          <Field label="메모">
            <input className={inputCls} placeholder="거래처, 영수증 번호 등" value={p.memo ?? ""} onChange={(e) => setP({ ...p, memo: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {p.items.map((it, i) => {
          const ing = ingredients.find((g) => g.id === it.ingredientId);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className={ic("min-w-36 flex-1")} value={it.ingredientId} onChange={(e) => {
                const g = ingredients.find((x) => x.id === e.target.value);
                setItem(i, { ingredientId: e.target.value, packPrice: g?.packPrice ?? it.packPrice });
              }} aria-label="재료">
                {ingredients.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({num(g.packSize)}
                    {g.unit})
                  </option>
                ))}
              </select>
              <NumInput className="w-20" value={it.packs} min={0} onChange={(n) => setItem(i, { packs: n })} aria-label="수량(포장 단위)" />
              <span className="text-xs text-ink-2">개 ×</span>
              <NumInput className="w-28" value={it.packPrice} step={100} onChange={(n) => setItem(i, { packPrice: n })} aria-label="포장 1개 가격" />
              <span className="w-24 text-right text-xs tabular">{won(it.packs * it.packPrice)}</span>
              {ing && it.packPrice !== ing.packPrice && (
                <Badge tone={it.packPrice > ing.packPrice ? "bad" : "good"}>
                  단가 {it.packPrice > ing.packPrice ? "▲" : "▼"} {pct(Math.abs(it.packPrice - ing.packPrice) / (ing.packPrice || 1), 0)}
                </Badge>
              )}
              <button className="text-ink-2 hover:text-bad" aria-label="항목 삭제" onClick={() => setP({ ...p, items: p.items.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          );
        })}
        <Button size="sm" variant="ghost" onClick={addItem} disabled={ingredients.length === 0}>
          + 재료 추가
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          합계 <b className="tabular">{won(purchaseAmount(p))}</b>
          <span className="ml-2 text-xs text-ink-2">저장하면 가장 최근 매입가로 재료 단가가 갱신됩니다.</span>
        </span>
        <Button
          disabled={!valid}
          onClick={() => {
            savePurchase(p);
            onClose();
          }}
        >
          저장
        </Button>
      </div>
    </Card>
  );
}
