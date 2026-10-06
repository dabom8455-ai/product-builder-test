import { describe, expect, it } from "vitest";
import { menuCost, priceForTargetRatio, unitMargin, unitCost } from "../cost";
import type { Ingredient, Menu } from "../../types";

const ing = (id: string, packSize: number, packPrice: number): Ingredient => ({ id, name: id, unit: "g", packSize, packPrice, updatedAt: "2026-10-01" });
const base = { category: "drink" as const, price: 5000, deliveryPrice: 5500, isSub: false, yieldQty: 1, yieldUnit: "개", lossRate: 0, active: true };

describe("cost", () => {
  const ings = new Map([["bean", ing("bean", 1000, 28000)], ["milk", ing("milk", 1000, 2700)], ["sugar", ing("sugar", 1000, 2000)]]);
  const syrup: Menu = { ...base, id: "syrup", name: "시럽", isSub: true, yieldQty: 500, yieldUnit: "ml", recipe: [{ refId: "sugar", kind: "ingredient", qty: 500 }] };
  const latte: Menu = {
    ...base,
    id: "latte",
    name: "라떼",
    recipe: [
      { refId: "bean", kind: "ingredient", qty: 18 },
      { refId: "milk", kind: "ingredient", qty: 200 },
      { refId: "syrup", kind: "sub", qty: 25 },
    ],
  };
  const menus = new Map([["syrup", syrup], ["latte", latte]]);

  it("unit cost per gram", () => {
    expect(unitCost(ings.get("bean")!)).toBe(28);
  });

  it("sums ingredients and sub-recipes", () => {
    // 18*28 + 200*2.7 + 25*(1000/500) = 504 + 540 + 50
    expect(menuCost(latte, ings, menus).total).toBeCloseTo(1094);
  });

  it("applies loss rate", () => {
    expect(menuCost({ ...latte, lossRate: 0.1 }, ings, menus).total).toBeCloseTo(1203.4);
  });

  it("breaks recursion cycles", () => {
    const a: Menu = { ...base, id: "a", name: "a", recipe: [{ refId: "b", kind: "sub", qty: 1 }] };
    const b: Menu = { ...base, id: "b", name: "b", recipe: [{ refId: "a", kind: "sub", qty: 1 }, { refId: "bean", kind: "ingredient", qty: 1 }] };
    const m = new Map([["a", a], ["b", b]]);
    expect(menuCost(a, ings, m).total).toBeCloseTo(28);
  });

  it("price for target ratio rounds up to 100 won", () => {
    expect(priceForTargetRatio(1094, 0.3)).toBe(3700);
  });

  it("delivery margin subtracts VAT, fee and packaging", () => {
    const r = unitMargin(5500, 1094, 0.1, 150, "general");
    expect(r.vat).toBeCloseTo(500);
    expect(r.margin).toBeCloseTo(5000 - 550 - 150 - 1094);
  });
});
