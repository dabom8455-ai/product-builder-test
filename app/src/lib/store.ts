"use client";

import { create } from "zustand";
import { useMemo } from "react";
import type {
  Attendance,
  Employee,
  Expense,
  Ingredient,
  IngredientPrice,
  LaborRule,
  DayNote,
  Menu,
  MenuActionLog,
  Purchase,
  RecurringExpense,
  Review,
  SaleLine,
  Shift,
  Store,
} from "./types";
import { DEFAULT_LABOR_RULE, DEFAULT_STORE, buildSeed, priceHistorySeed } from "./seed";
import { todayLocal } from "./dates";
import { menuCost } from "./domain/cost";
import { analyzeReview } from "./domain/review";

// 단일 매장용 앱 상태. 어디에 저장할지는 persistence.ts 의 어댑터가 정한다(브라우저 저장소 / claude.ai db).

export interface AppData {
  store: Store;
  laborRule: LaborRule;
  ingredients: Ingredient[];
  priceHistory: IngredientPrice[];
  menus: Menu[];
  sales: SaleLine[];
  employees: Employee[];
  attendance: Attendance[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  reviews: Review[];
  actions: MenuActionLog[];
  purchases: Purchase[];
  shifts: Shift[];
  dayNotes: DayNote[];
}

export const APP_KEYS = [
  "store",
  "laborRule",
  "ingredients",
  "priceHistory",
  "menus",
  "sales",
  "employees",
  "attendance",
  "expenses",
  "recurring",
  "reviews",
  "actions",
  "purchases",
  "shifts",
  "dayNotes",
] as const satisfies readonly (keyof AppData)[];

interface Actions {
  setStore: (patch: Partial<Store>) => void;
  setLaborRule: (patch: Partial<LaborRule>) => void;
  upsert: <K extends ListKey>(key: K, item: AppData[K][number]) => void;
  remove: (key: ListKey, id: string) => void;
  /** 재료 단가 변경 시 이력도 함께 남긴다 */
  updateIngredientPrice: (id: string, packPrice: number, packSize?: number) => void;
  /** 특정 날짜·채널 판매 수량을 통째로 교체 (마감 입력) */
  replaceSales: (date: string, channel: SaleLine["channel"], lines: { menuId: string; qty: number }[]) => void;
  importSales: (lines: SaleLine[]) => void;
  loadDemo: () => void;
  resetEmpty: () => void;
  importAll: (data: Partial<AppData>) => void;
  /** 매입 저장: 기록을 남기고, 가장 최근 매입이면 재료 단가를 갱신한다 */
  savePurchase: (p: Purchase) => void;
  addShifts: (shifts: Shift[]) => void;
}

type ListKey = {
  [K in keyof AppData]: AppData[K] extends { id: string }[] ? K : never;
}[keyof AppData];

export function demoData(): AppData {
  const today = todayLocal();
  const seed = buildSeed(today);
  return {
    store: DEFAULT_STORE,
    laborRule: DEFAULT_LABOR_RULE,
    priceHistory: priceHistorySeed(seed.ingredients, today),
    actions: [],
    ...seed,
    reviews: seed.reviews.map((r) => {
      const a = analyzeReview(r.text, r.rating, seed.menus);
      return { ...r, sentiment: a.sentiment, menuIds: a.menuIds, keywords: [...a.keywords, ...a.issues] };
    }),
  };
}

export function emptyData(): AppData {
  return {
    store: { ...DEFAULT_STORE, name: "내 카페" },
    laborRule: DEFAULT_LABOR_RULE,
    ingredients: [],
    priceHistory: [],
    menus: [],
    sales: [],
    employees: [],
    attendance: [],
    expenses: [],
    recurring: [],
    reviews: [],
    actions: [],
    purchases: [],
    shifts: [],
    dayNotes: [],
  };
}

/** 저장된 일부 데이터를 기본값 위에 얹어 완전한 AppData 로 만든다 (필드가 추가돼도 옛 데이터가 깨지지 않게) */
export function completeData(partial: Partial<AppData>): AppData {
  const base = emptyData();
  return {
    ...base,
    ...partial,
    store: { ...DEFAULT_STORE, ...partial.store },
    laborRule: { ...DEFAULT_LABOR_RULE, ...partial.laborRule },
  };
}

export function pickData(s: AppData): AppData {
  return Object.fromEntries(APP_KEYS.map((k) => [k, s[k]])) as unknown as AppData;
}

// 저장소에서 불러오기 전에는 빈 데이터다. 화면은 useHydrated() 가 true 가 된 뒤에 그린다.
export const useApp = create<AppData & Actions>()((set) => ({
  ...emptyData(),
  setStore: (patch) => set((s) => ({ store: { ...s.store, ...patch } })),
  setLaborRule: (patch) => set((s) => ({ laborRule: { ...s.laborRule, ...patch } })),
  upsert: (key, item) =>
    set((s) => {
      const list = s[key] as { id: string }[];
      const idx = list.findIndex((x) => x.id === item.id);
      const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item];
      return { [key]: next } as Partial<AppData>;
    }),
  remove: (key, id) => set((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<AppData>),
  updateIngredientPrice: (id, packPrice, packSize) =>
    set((s) => {
      const today = todayLocal();
      return {
        ingredients: s.ingredients.map((i) => (i.id === id ? { ...i, packPrice, packSize: packSize ?? i.packSize, updatedAt: today } : i)),
        priceHistory: [
          ...s.priceHistory.filter((p) => !(p.ingredientId === id && p.date === today)),
          { ingredientId: id, packPrice, date: today },
        ],
      };
    }),
  replaceSales: (date, channel, lines) =>
    set((s) => ({
      sales: [
        ...s.sales.filter((l) => !(l.date === date && l.channel === channel)),
        ...lines
          .filter((l) => l.qty > 0)
          .map((l) => ({ id: `sl-${date}-${l.menuId}-${channel}`, date, channel, menuId: l.menuId, qty: l.qty })),
      ],
    })),
  importSales: (lines) =>
    set((s) => {
      const keys = new Set(lines.map((l) => `${l.date}|${l.channel}`));
      return { sales: [...s.sales.filter((l) => !keys.has(`${l.date}|${l.channel}`)), ...lines] };
    }),
  loadDemo: () => set(demoData()),
  resetEmpty: () => set(emptyData()),
  importAll: (data) => set(completeData(data)),
  savePurchase: (p) =>
    set((s) => {
      const purchases = [...s.purchases.filter((x) => x.id !== p.id), p];
      let ingredients = s.ingredients;
      let priceHistory = s.priceHistory;
      for (const it of p.items) {
        const ing = ingredients.find((i) => i.id === it.ingredientId);
        if (!ing || it.packPrice <= 0) continue;
        priceHistory = [...priceHistory.filter((h) => !(h.ingredientId === ing.id && h.date === p.date)), { ingredientId: ing.id, packPrice: it.packPrice, date: p.date }];
        if (p.date >= ing.updatedAt) ingredients = ingredients.map((i) => (i.id === ing.id ? { ...i, packPrice: it.packPrice, updatedAt: p.date } : i));
      }
      return { purchases, ingredients, priceHistory };
    }),
  addShifts: (shifts) => set((s) => ({ shifts: [...s.shifts, ...shifts] })),
}));

export function useMaps() {
  const ingredients = useApp((s) => s.ingredients);
  const menus = useApp((s) => s.menus);
  return useMemo(() => {
    const ingMap = new Map(ingredients.map((i) => [i.id, i]));
    const menuMap = new Map(menus.map((m) => [m.id, m]));
    const unitCosts = new Map(menus.map((m) => [m.id, menuCost(m, ingMap, menuMap).total]));
    return { ingMap, menuMap, unitCosts };
  }, [ingredients, menus]);
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
