import type { Ingredient, Menu, Purchase, SaleLine } from "../types";
import { unitCost } from "./cost";

/**
 * 메뉴 1개(서브레시피는 1 생산단위)를 만들 때 쓰는 재료량. 서브레시피는 재료로 펼치고 로스율을 포함한다.
 * 순환 참조는 끊는다.
 */
export function ingredientsPerUnit(menu: Menu, menus: Map<string, Menu>, seen: Set<string> = new Set()): Map<string, number> {
  const out = new Map<string, number>();
  if (seen.has(menu.id)) return out;
  const nextSeen = new Set(seen).add(menu.id);
  const factor = 1 + (menu.lossRate || 0);
  for (const item of menu.recipe) {
    if (item.kind === "ingredient") {
      out.set(item.refId, (out.get(item.refId) ?? 0) + item.qty * factor);
    } else {
      const sub = menus.get(item.refId);
      if (!sub || sub.yieldQty <= 0) continue;
      const share = (item.qty / sub.yieldQty) * factor;
      for (const [id, q] of ingredientsPerUnit(sub, menus, nextSeen)) out.set(id, (out.get(id) ?? 0) + q * share);
    }
  }
  return out;
}

/** 판매 기록 기준 재료별 이론 사용량 */
export function theoreticalUsage(sales: SaleLine[], menus: Map<string, Menu>): Map<string, number> {
  const qtyByMenu = new Map<string, number>();
  for (const l of sales) qtyByMenu.set(l.menuId, (qtyByMenu.get(l.menuId) ?? 0) + l.qty);
  const out = new Map<string, number>();
  for (const [menuId, qty] of qtyByMenu) {
    const menu = menus.get(menuId);
    if (!menu) continue;
    for (const [id, q] of ingredientsPerUnit(menu, menus)) out.set(id, (out.get(id) ?? 0) + q * qty);
  }
  return out;
}

export function purchaseAmount(p: Purchase): number {
  return p.items.reduce((t, i) => t + i.packs * i.packPrice, 0);
}

/** 기간 내 매입: 재료별 구매량(재료 단위)과 금액 */
export function purchasedByIngredient(purchases: Purchase[], ingredients: Map<string, Ingredient>) {
  const out = new Map<string, { qty: number; amount: number }>();
  for (const p of purchases)
    for (const it of p.items) {
      const ing = ingredients.get(it.ingredientId);
      if (!ing) continue;
      const cur = out.get(it.ingredientId) ?? { qty: 0, amount: 0 };
      cur.qty += it.packs * ing.packSize;
      cur.amount += it.packs * it.packPrice;
      out.set(it.ingredientId, cur);
    }
  return out;
}

export interface LossRow {
  ingredient: Ingredient;
  used: number;
  purchased: number;
  /** 매입 − 이론 사용량 (재료 단위). 양수면 레시피보다 더 쓰였거나 남아 있음 */
  diff: number;
  diffRate: number;
  diffCost: number;
}

/**
 * 로스 분석: 매입량과 레시피 기준 사용량의 차이. 재고 변동은 반영하지 않는다.
 * 매입 기록이 있는 재료만 비교한다(매입 기록이 없는 재료는 판단 근거가 없으므로).
 */
export function lossReport(args: {
  sales: SaleLine[];
  purchases: Purchase[];
  menus: Map<string, Menu>;
  ingredients: Map<string, Ingredient>;
}): LossRow[] {
  const used = theoreticalUsage(args.sales, args.menus);
  const bought = purchasedByIngredient(args.purchases, args.ingredients);
  const rows: LossRow[] = [];
  for (const [id, b] of bought) {
    const ingredient = args.ingredients.get(id)!;
    const u = used.get(id) ?? 0;
    const diff = b.qty - u;
    rows.push({ ingredient, used: u, purchased: b.qty, diff, diffRate: b.qty > 0 ? diff / b.qty : 0, diffCost: diff * unitCost(ingredient) });
  }
  return rows.sort((a, b) => b.diffCost - a.diffCost);
}
