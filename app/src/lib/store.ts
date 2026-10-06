"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useMemo, useSyncExternalStore } from "react";
import type {
  Attendance,
  Employee,
  Expense,
  Ingredient,
  IngredientPrice,
  LaborRule,
  Menu,
  MenuActionLog,
  RecurringExpense,
  Review,
  SaleLine,
  Store,
} from "./types";
import { DEFAULT_LABOR_RULE, DEFAULT_STORE, buildSeed, priceHistorySeed } from "./seed";
import { todayLocal } from "./dates";
import { menuCost } from "./domain/cost";
import { analyzeReview } from "./domain/review";

// 단일 매장용 로컬 저장소(브라우저 localStorage). 백엔드(Supabase) 연동 시 이 모듈만 교체한다.

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
}

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
  importAll: (data: AppData) => void;
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

function emptyData(): AppData {
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
  };
}

export const useApp = create<AppData & Actions>()(
  persist(
    (set) => ({
      ...demoData(),
      setStore: (patch) => set((s) => ({ store: { ...s.store, ...patch } })),
      setLaborRule: (patch) => set((s) => ({ laborRule: { ...s.laborRule, ...patch } })),
      upsert: (key, item) =>
        set((s) => {
          const list = s[key] as { id: string }[];
          const idx = list.findIndex((x) => x.id === item.id);
          const next = idx >= 0 ? list.map((x, i) => (i === idx ? item : x)) : [...list, item];
          return { [key]: next } as Partial<AppData>;
        }),
      remove: (key, id) =>
        set((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<AppData>),
      updateIngredientPrice: (id, packPrice, packSize) =>
        set((s) => {
          const today = todayLocal();
          return {
            ingredients: s.ingredients.map((i) =>
              i.id === id ? { ...i, packPrice, packSize: packSize ?? i.packSize, updatedAt: today } : i,
            ),
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
      importAll: (data) => set(data),
    }),
    {
      name: "cafedam-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

/** 클라이언트에서 저장소 복원이 끝났는지. 서버 렌더와 첫 렌더를 일치시키기 위해 사용한다. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useApp.persist.onFinishHydration(cb),
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

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
