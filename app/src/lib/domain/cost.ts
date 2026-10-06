import type { Ingredient, Menu, Store } from "../types";

export function unitCost(ing: Ingredient): number {
  return ing.packSize > 0 ? ing.packPrice / ing.packSize : 0;
}

export interface CostLine {
  name: string;
  qty: number;
  unit: string;
  cost: number;
}

/**
 * 메뉴 1개(서브레시피는 1 yield 단위)의 원가.
 * 서브레시피는 재귀적으로 계산하며 순환 참조는 0원으로 끊는다.
 */
export function menuCost(
  menu: Menu,
  ingredients: Map<string, Ingredient>,
  menus: Map<string, Menu>,
  seen: Set<string> = new Set(),
): { total: number; lines: CostLine[] } {
  if (seen.has(menu.id)) return { total: 0, lines: [] };
  const nextSeen = new Set(seen).add(menu.id);
  const lines: CostLine[] = [];
  for (const item of menu.recipe) {
    if (item.kind === "ingredient") {
      const ing = ingredients.get(item.refId);
      if (!ing) continue;
      lines.push({ name: ing.name, qty: item.qty, unit: ing.unit, cost: unitCost(ing) * item.qty });
    } else {
      const sub = menus.get(item.refId);
      if (!sub) continue;
      const subTotal = menuCost(sub, ingredients, menus, nextSeen).total;
      const perUnit = sub.yieldQty > 0 ? subTotal / sub.yieldQty : 0;
      lines.push({ name: sub.name, qty: item.qty, unit: sub.yieldUnit, cost: perUnit * item.qty });
    }
  }
  const raw = lines.reduce((s, l) => s + l.cost, 0);
  const total = raw * (1 + (menu.lossRate || 0));
  return { total, lines };
}

export function costRatio(cost: number, price: number): number {
  return price > 0 ? cost / price : 0;
}

/** 목표 원가율을 맞추는 판매가 (100원 단위 올림) */
export function priceForTargetRatio(cost: number, target: number): number {
  if (target <= 0) return 0;
  return Math.ceil(cost / target / 100) * 100;
}

/** 부가세 제외 공급가. 일반과세자만 1/11을 뺀다(간이과세는 업종부가율 적용이 복잡해 근사). */
export function netOfVat(gross: number, vatMode: Store["vatMode"]): number {
  if (vatMode === "general") return gross / 1.1;
  if (vatMode === "simplified") return gross - gross * 0.15 * 0.1; // 음식점업 부가율 15% 근사
  return gross;
}

export interface MarginBreakdown {
  price: number;
  vat: number;
  fee: number;
  packaging: number;
  cost: number;
  margin: number;
  marginRate: number;
}

/** 채널별 한 잔(개)당 실질 마진 */
export function unitMargin(
  price: number,
  cost: number,
  feeRate: number,
  packaging: number,
  vatMode: Store["vatMode"],
): MarginBreakdown {
  const net = netOfVat(price, vatMode);
  const vat = price - net;
  const fee = price * feeRate;
  const margin = net - fee - packaging - cost;
  return { price, vat, fee, packaging, cost, margin, marginRate: price > 0 ? margin / price : 0 };
}
