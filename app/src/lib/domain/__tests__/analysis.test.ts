import { describe, expect, it } from "vitest";
import { buildSeed } from "../../seed";
import { DEFAULT_STORE, DEFAULT_LABOR_RULE } from "../../seed";
import { menuCost } from "../cost";
import { analyzeMenus } from "../menuEngineering";
import { calcPnl } from "../pnl";
import { calcPayroll } from "../payroll";
import { analyzeReview, matchMenus, templateReply } from "../review";

const today = "2026-10-06";
const seed = buildSeed(today);
const ingMap = new Map(seed.ingredients.map((i) => [i.id, i]));
const menuMap = new Map(seed.menus.map((m) => [m.id, m]));
const unitCosts = new Map(seed.menus.map((m) => [m.id, menuCost(m, ingMap, menuMap).total]));

describe("seed-based analysis", () => {
  it("every sellable menu has a positive cost", () => {
    for (const m of seed.menus.filter((m) => !m.isSub)) expect(unitCosts.get(m.id)).toBeGreaterThan(0);
  });

  it("P&L adds up", () => {
    const month = "2026-09";
    const labor = seed.employees.reduce((t, e) => {
      const p = calcPayroll(e, seed.attendance, month, DEFAULT_LABOR_RULE, false);
      return t + p.gross + p.employerInsurance;
    }, 0);
    const p = calcPnl({ month, sales: seed.sales, menus: menuMap, unitCosts, store: DEFAULT_STORE, labor, expenses: seed.expenses, recurring: seed.recurring });
    expect(p.grossSales).toBeGreaterThan(0);
    expect(p.operatingProfit).toBeCloseTo(p.grossSales - p.vat - p.cogs - p.fees - p.packaging - p.labor - p.fixed - p.variable);
    expect(p.byChannel.reduce((t, c) => t + c.sales, 0)).toBeCloseTo(p.grossSales);
  });

  it("menu engineering classifies the low-selling expensive pound cake as a dog", () => {
    const reviews = seed.reviews.map((r) => ({ ...r, ...analyzeReview(r.text, r.rating, seed.menus) }));
    const a = analyzeMenus({ menus: seed.menus, sales: seed.sales, unitCosts, store: DEFAULT_STORE, reviews, midDate: "2026-09-05" });
    const pound = a.stats.find((s) => s.menu.id === "m-earlgrey-pound")!;
    expect(pound.quadrant).toBe("dog");
    expect(a.stats.find((s) => s.menu.id === "m-ice-americano")!.mixShare).toBeGreaterThan(a.mixThreshold);
    expect(a.suggestions.some((s) => s.menuId === "m-earlgrey-pound" && s.action === "fix")).toBe(true);
  });
});

describe("review", () => {
  it("matches menu names and aliases, preferring longer names", () => {
    expect(matchMenus("아아 진하고 좋아요", seed.menus)).toEqual(["m-ice-americano"]);
    expect(matchMenus("바닐라라떼 최고", seed.menus)).toEqual(["m-vanilla-latte"]);
  });

  it("classifies sentiment", () => {
    expect(analyzeReview("너무 맛있어요 재주문 할게요", 5, seed.menus).sentiment).toBe("positive");
    expect(analyzeReview("맛없어요 다시는 안 시킬듯", 1, seed.menus).sentiment).toBe("negative");
    expect(analyzeReview("뚜껑이 안 닫혀서 흘러 있었어요", 3, seed.menus).issues).toContain("포장");
  });

  it("template reply apologises on negative reviews without promising refunds", () => {
    const text = "얼그레이 파운드 맛없어요";
    const analysis = analyzeReview(text, 1, seed.menus);
    const reply = templateReply({ storeName: "카페 댐", tone: "witty", text, rating: 1, analysis, menuNames: ["얼그레이 파운드"], recentReplies: [] });
    expect(reply).toContain("죄송");
    expect(reply).not.toMatch(/환불|쿠폰|할인/);
  });
});
