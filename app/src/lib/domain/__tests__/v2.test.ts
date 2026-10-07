import { describe, expect, it } from "vitest";
import { buildSeed, DEFAULT_STORE } from "../../seed";
import { businessDays } from "../../dates";
import { ingredientsPerUnit, lossReport, theoreticalUsage } from "../usage";
import { compareShifts, copyWeek, forecastLabor, shiftWorkMinutes } from "../schedule";
import { applyScenario, breakEvenVolumeChange, NO_CHANGE } from "../scenario";
import { topMenus, weekdayMatrix } from "../menuEngineering";
import { parseBulkReviews, templateReply, analyzeReview, withSignature } from "../review";
import { templateCaption } from "../poster";
import { buildTodos } from "../todos";
import { calcPnl } from "../pnl";
import { menuCost } from "../cost";
import type { Attendance, Employee, Shift } from "../../types";

const today = "2026-10-06";
const seed = buildSeed(today);
const ingMap = new Map(seed.ingredients.map((i) => [i.id, i]));
const menuMap = new Map(seed.menus.map((m) => [m.id, m]));
const unitCosts = new Map(seed.menus.map((m) => [m.id, menuCost(m, ingMap, menuMap).total]));

describe("usage & loss", () => {
  it("expands sub-recipes into ingredients", () => {
    const u = ingredientsPerUnit(menuMap.get("m-vanilla-latte")!, menuMap);
    // 바닐라시럽 25ml / 1000ml 생산 × 설탕 600g, 로스율 3% 가 두 번(메뉴·서브) 적용
    expect(u.get("i-sugar")).toBeCloseTo((25 / 1000) * 1.03 * 600 * 1.03, 5);
    expect(u.get("i-bean")).toBeCloseTo(18 * 1.03, 5);
  });

  it("theoretical usage scales with sales", () => {
    const one = theoreticalUsage([{ id: "x", date: today, channel: "hall", menuId: "m-latte", qty: 10 }], menuMap);
    expect(one.get("i-milk")).toBeCloseTo(200 * 1.03 * 10);
  });

  it("loss report flags the seeded milk over-purchase above beans", () => {
    const month = "2026-09";
    const rows = lossReport({
      sales: seed.sales.filter((l) => l.date.startsWith(month)),
      purchases: seed.purchases.filter((p) => p.date.startsWith(month)),
      menus: menuMap,
      ingredients: ingMap,
    });
    const milk = rows.find((r) => r.ingredient.id === "i-milk")!;
    const bean = rows.find((r) => r.ingredient.id === "i-bean")!;
    expect(milk.diffRate).toBeGreaterThan(bean.diffRate);
    expect(milk.diff).toBeGreaterThan(0);
  });
});

describe("schedule", () => {
  const emp: Employee = { id: "e", name: "알바", hourlyWage: 10000, weeklyContractHours: 20, taxType: "none", contractSigned: true, pin: "1", active: true };
  const sh = (date: string, start = "10:00", end = "14:30"): Shift => ({ id: date, employeeId: "e", date, start, end });

  it("work minutes subtract statutory break and handle overnight", () => {
    expect(shiftWorkMinutes(sh("2026-10-05", "10:00", "14:30"))).toBe(240);
    expect(shiftWorkMinutes(sh("2026-10-05", "22:00", "02:00"))).toBe(210);
  });

  it("detects late, early, absent, upcoming", () => {
    const att: Attendance[] = [
      { id: "a", employeeId: "e", clockIn: "2026-10-05T10:12", clockOut: "2026-10-05T14:30" },
      { id: "b", employeeId: "e", clockIn: "2026-10-06T10:00", clockOut: "2026-10-06T13:00" },
    ];
    const r = compareShifts([sh("2026-10-05"), sh("2026-10-06"), sh("2026-10-04"), sh("2026-10-08")], att, "2026-10-07");
    expect(r.map((x) => x.status)).toEqual(["late", "early", "absent", "upcoming"]);
    expect(Math.round(r[0].lateMin)).toBe(12);
  });

  it("forecasts labor with weekly holiday pay", () => {
    const shifts = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"].map((d) => sh(d));
    const f = forecastLabor(emp, shifts, "2026-10-01", "2026-11-01");
    expect(f.hours).toBe(20);
    expect(f.basePay).toBe(200000);
    expect(f.weeklyHolidayPay).toBe(40000);
  });

  it("copies last week without duplicating existing shifts", () => {
    const shifts = [sh("2026-09-28"), sh("2026-09-29"), sh("2026-10-06")];
    let i = 0;
    const out = copyWeek(shifts, "2026-09-28", "2026-10-05", () => `n${i++}`);
    expect(out.map((s) => s.date)).toEqual(["2026-10-05"]);
  });
});

describe("scenario", () => {
  const p = calcPnl({ month: "2026-09", sales: seed.sales, menus: menuMap, unitCosts, store: DEFAULT_STORE, labor: 2_000_000, expenses: seed.expenses, recurring: seed.recurring });
  it("no change keeps profit", () => {
    expect(applyScenario(p, NO_CHANGE).operatingProfit).toBeCloseTo(p.operatingProfit);
  });
  it("price increase with break-even volume loss keeps contribution", () => {
    const v = breakEvenVolumeChange(p, 0.05)!;
    expect(v).toBeLessThan(0);
    expect(applyScenario(p, { ...NO_CHANGE, pricePct: 0.05, volumePct: v }).operatingProfit).toBeCloseTo(p.operatingProfit, 0);
  });
  it("labor delta flows straight to profit", () => {
    expect(applyScenario(p, { ...NO_CHANGE, laborDelta: 300000 }).delta).toBeCloseTo(-300000);
  });
});

describe("analysis helpers", () => {
  it("business days excludes closed weekdays", () => {
    expect(businessDays("2026-10", [])).toBe(31);
    expect(businessDays("2026-10", [1])).toBe(27); // 2026-10 월요일 4번
  });
  it("weekday matrix averages per weekday occurrence", () => {
    const m = weekdayMatrix(
      [
        { id: "1", date: "2026-10-05", channel: "hall", menuId: "a", qty: 4 },
        { id: "2", date: "2026-10-12", channel: "hall", menuId: "a", qty: 2 },
      ],
      ["a"],
      "2026-10-05",
      "2026-10-19",
    );
    expect(m[0].avg[1]).toBe(3);
    expect(m[0].avg[2]).toBe(0);
  });
  it("top menus by channel group", () => {
    const t = topMenus(seed.sales, ["baemin", "coupang", "yogiyo"], 3);
    expect(t[0].menuId).toBe("m-ice-americano");
  });
});

describe("reviews & captions", () => {
  it("parses bulk reviews and ratings", () => {
    const r = parseBulkReviews("★★★★☆ 라떼 맛있어요\n\n별점 2 너무 늦게 왔어요\n\n그냥 무난했어요 3점\n\n그냥 좋아요", 5);
    expect(r.map((x) => x.rating)).toEqual([4, 2, 3, 5]);
    expect(r[0].text).toBe("라떼 맛있어요");
    expect(r[3].ratingDetected).toBe(false);
  });
  it("appends signature once", () => {
    expect(withSignature("감사합니다.", "— 사장 드림")).toBe("감사합니다.\n\n— 사장 드림");
    const text = "라떼 맛있어요";
    const reply = templateReply({ storeName: "카페", tone: "polite", text, rating: 5, analysis: analyzeReview(text, 5, seed.menus), menuNames: [], recentReplies: [], signature: "— 사장 드림" });
    expect(reply.endsWith("— 사장 드림")).toBe(true);
  });
  it("caption includes discount and hashtags", () => {
    const c = templateCaption({ storeName: "카페 댐", menuName: "흑임자 라떼", price: 6300, discountPrice: 5300, purpose: "event", copy: { headline: "흑임자 데이", sub: "" }, praise: [] });
    expect(c).toContain("6,300원 → 5,300원");
    expect(c).toContain("#카페댐");
    expect(c).toContain("#흑임자라떼");
  });
});

describe("todos", () => {
  it("lists urgent items first", () => {
    const todos = buildTodos({
      today,
      store: DEFAULT_STORE,
      sales: seed.sales,
      reviews: seed.reviews.map((r) => ({ ...r, ...analyzeReview(r.text, r.rating, seed.menus) })),
      attendance: [...seed.attendance, { id: "open", employeeId: "e-minji", clockIn: "2026-10-01T10:00" }],
      employees: seed.employees,
      shifts: seed.shifts,
      menus: seed.menus,
      unitCosts,
    });
    expect(todos[0].level).toBe("urgent");
    expect(todos.some((t) => t.id === "open-open")).toBe(true);
    expect(todos.some((t) => t.id === "cost-m-earlgrey-pound")).toBe(true);
    expect(todos.some((t) => t.id === "hc-e-seojun")).toBe(true);
  });
});
