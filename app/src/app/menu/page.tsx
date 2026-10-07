"use client";

import { useMemo, useState } from "react";
import { newId, useApp, useMaps } from "@/lib/store";
import type { Ingredient, Menu, MenuCategory } from "@/lib/types";
import { CHANNELS } from "@/lib/types";
import { costRatio, menuCost, priceForTargetRatio, unitCost, unitMargin } from "@/lib/domain/cost";
import { Badge, Button, Card, Empty, Explain, Field, NumInput, PageHeader, Segmented, ic, inputCls } from "@/components/ui";
import { num, pct, won } from "@/lib/format";
import { addDays, todayLocal } from "@/lib/dates";
import { askConfirm } from "@/components/Confirm";

type Tab = "menus" | "ingredients" | "simulate";

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
              { id: "simulate", label: "단가 변동 시뮬" },
            ]}
          />
        }
      />
      {tab === "menus" && <MenusTab />}
      {tab === "ingredients" && <IngredientsTab />}
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
        <MenuEditor key={editing} menu={menus.find((m) => m.id === editing)!} onClose={() => setEditing(null)} />
      ) : (
        <Empty>왼쪽에서 메뉴를 선택하면 레시피와 원가를 편집할 수 있습니다.</Empty>
      )}
    </div>
  );
}

function MenuEditor({ menu, onClose }: { menu: Menu; onClose: () => void }) {
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

      <div className="mt-4 text-right">
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
