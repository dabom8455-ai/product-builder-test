import type { Menu, Review, SaleLine, Store } from "../types";
import { linePrice } from "./pnl";
import { netOfVat, priceForTargetRatio } from "./cost";

export type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";

export const QUADRANT_INFO: Record<Quadrant, { label: string; emoji: string; desc: string }> = {
  star: { label: "Star", emoji: "⭐", desc: "많이 팔리고 마진도 높음 — 유지·대표메뉴화" },
  plowhorse: { label: "Plowhorse", emoji: "🐴", desc: "많이 팔리지만 마진 낮음 — 가격 인상·원가 절감" },
  puzzle: { label: "Puzzle", emoji: "🧩", desc: "마진 높지만 덜 팔림 — 홍보·노출 강화" },
  dog: { label: "Dog", emoji: "🐶", desc: "덜 팔리고 마진 낮음 — 단종·리뉴얼 후보" },
};

export interface MenuStat {
  menu: Menu;
  qty: number;
  sales: number;
  unitCost: number;
  /** 판매 1개당 평균 공헌이익 (부가세·수수료·포장재·원가 차감) */
  unitMargin: number;
  totalMargin: number;
  mixShare: number;
  costRatio: number;
  quadrant: Quadrant;
  negativeReviews: number;
  positiveReviews: number;
  /** 최근 절반 기간 대비 추세 (+면 증가) */
  trend: number;
}

export interface Suggestion {
  menuId: string;
  quadrant: Quadrant;
  title: string;
  detail: string;
  action: "promote" | "reprice" | "keep" | "drop" | "fix";
}

export interface MenuAnalysis {
  stats: MenuStat[];
  mixThreshold: number;
  avgMargin: number;
  suggestions: Suggestion[];
}

export function analyzeMenus(args: {
  menus: Menu[];
  sales: SaleLine[]; // 분석 기간으로 이미 필터링된 판매
  unitCosts: Map<string, number>;
  store: Store;
  reviews: Review[];
  midDate: string; // 추세 계산 기준일 (기간 중간)
}): MenuAnalysis {
  const { store } = args;
  const sellable = args.menus.filter((m) => !m.isSub && m.active);
  const agg = new Map<string, { qty: number; sales: number; margin: number; early: number; late: number }>();
  for (const m of sellable) agg.set(m.id, { qty: 0, sales: 0, margin: 0, early: 0, late: 0 });

  for (const l of args.sales) {
    const a = agg.get(l.menuId);
    const m = sellable.find((x) => x.id === l.menuId);
    if (!a || !m) continue;
    const price = linePrice(m, l.channel);
    const delivery = l.channel !== "hall" && l.channel !== "naver";
    const unitCost = args.unitCosts.get(m.id) ?? 0;
    const per =
      netOfVat(price, store.vatMode) -
      price * (store.channelFeeRate[l.channel] ?? 0) -
      (delivery ? store.deliveryPackagingCost : 0) -
      unitCost;
    a.qty += l.qty;
    a.sales += price * l.qty;
    a.margin += per * l.qty;
    if (l.date < args.midDate) a.early += l.qty;
    else a.late += l.qty;
  }

  const totalQty = [...agg.values()].reduce((t, a) => t + a.qty, 0);
  const totalMargin = [...agg.values()].reduce((t, a) => t + a.margin, 0);
  const n = sellable.length || 1;
  const mixThreshold = (1 / n) * 0.7;
  const avgMargin = totalQty > 0 ? totalMargin / totalQty : 0;

  const stats: MenuStat[] = sellable.map((menu) => {
    const a = agg.get(menu.id)!;
    const unitCost = args.unitCosts.get(menu.id) ?? 0;
    const unitMargin = a.qty > 0 ? a.margin / a.qty : netOfVat(menu.price, store.vatMode) - unitCost;
    const mixShare = totalQty > 0 ? a.qty / totalQty : 0;
    const popular = mixShare >= mixThreshold;
    const profitable = unitMargin >= avgMargin;
    const quadrant: Quadrant = popular ? (profitable ? "star" : "plowhorse") : profitable ? "puzzle" : "dog";
    const related = args.reviews.filter((r) => r.menuIds.includes(menu.id));
    return {
      menu,
      qty: a.qty,
      sales: a.sales,
      unitCost,
      unitMargin,
      totalMargin: a.margin,
      mixShare,
      costRatio: menu.price > 0 ? unitCost / menu.price : 0,
      quadrant,
      negativeReviews: related.filter((r) => r.sentiment === "negative").length,
      positiveReviews: related.filter((r) => r.sentiment === "positive").length,
      trend: a.early > 0 ? (a.late - a.early) / a.early : a.late > 0 ? 1 : 0,
    };
  });
  stats.sort((x, y) => y.totalMargin - x.totalMargin);

  return { stats, mixThreshold, avgMargin, suggestions: buildSuggestions(stats, store) };
}

const won = (n: number) => `${Math.round(n).toLocaleString()}원`;

function buildSuggestions(stats: MenuStat[], store: Store): Suggestion[] {
  const out: Suggestion[] = [];
  for (const s of stats) {
    const target = s.menu.category === "drink" ? store.targetCostRatio.drink : store.targetCostRatio.dessert;
    const name = s.menu.name;
    if (s.negativeReviews >= 2 && s.negativeReviews > s.positiveReviews) {
      out.push({
        menuId: s.menu.id,
        quadrant: s.quadrant,
        action: "fix",
        title: `${name}: 부정 리뷰 ${s.negativeReviews}건 — 품질 점검 필요`,
        detail: "리뷰에서 반복 언급된 불만(맛·양·포장 등)을 확인하고 레시피/포장을 점검하세요.",
      });
    }
    switch (s.quadrant) {
      case "star":
        out.push({
          menuId: s.menu.id,
          quadrant: s.quadrant,
          action: "keep",
          title: `${name}: 대표 메뉴로 유지`,
          detail: `판매 비중 ${(s.mixShare * 100).toFixed(1)}%, 개당 마진 ${won(s.unitMargin)}. 메뉴판 최상단·대표 이미지로 노출을 유지하세요.`,
        });
        break;
      case "plowhorse": {
        const up = 300;
        const keepRate = 0.95; // 인상 후 판매 5% 감소 가정
        const before = s.unitMargin * s.qty;
        const after = (s.unitMargin + up / 1.1) * s.qty * keepRate;
        const suggested = priceForTargetRatio(s.unitCost, target);
        out.push({
          menuId: s.menu.id,
          quadrant: s.quadrant,
          action: "reprice",
          title: `${name}: ${up}원 인상 검토`,
          detail:
            `원가율 ${(s.costRatio * 100).toFixed(0)}%. ${up}원 인상 시 판매 5% 감소를 가정해도 분석기간 마진 ${won(before)} → ${won(after)} (${after >= before ? "+" : ""}${won(after - before)}).` +
            (suggested > s.menu.price ? ` 목표 원가율 ${(target * 100).toFixed(0)}% 기준 권장가 ${won(suggested)}.` : " 또는 레시피 재료 용량/단가 절감을 검토하세요."),
        });
        break;
      }
      case "puzzle":
        out.push({
          menuId: s.menu.id,
          quadrant: s.quadrant,
          action: "promote",
          title: `${name}: 숨은 고마진 메뉴 — 홍보 추천`,
          detail: `개당 마진 ${won(s.unitMargin)}(평균 이상)이지만 판매 비중 ${(s.mixShare * 100).toFixed(1)}%. 포스터·추천 문구·세트 구성으로 노출을 늘리세요.`,
        });
        break;
      case "dog":
        out.push({
          menuId: s.menu.id,
          quadrant: s.quadrant,
          action: "drop",
          title: `${name}: 단종 또는 리뉴얼 후보`,
          detail: `판매 비중 ${(s.mixShare * 100).toFixed(1)}%, 개당 마진 ${won(s.unitMargin)}. 재료 재고·폐기 부담을 고려해 단종하거나 레시피를 리뉴얼하세요.${s.trend > 0.2 ? " 다만 최근 판매가 증가 추세입니다." : ""}`,
        });
        break;
    }
  }
  const order = { fix: 0, reprice: 1, promote: 2, drop: 3, keep: 4 };
  return out.sort((a, b) => order[a.action] - order[b.action]);
}
