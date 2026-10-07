"use client";

import { useMemo } from "react";
import { useApp, useMaps } from "./store";
import { calcPayroll } from "./domain/payroll";
import { calcPnl } from "./domain/pnl";
import { analyzeMenus } from "./domain/menuEngineering";
import { addDays, businessDays, todayLocal } from "./dates";

export function usePayrolls(month: string) {
  const employees = useApp((s) => s.employees);
  const attendance = useApp((s) => s.attendance);
  const rule = useApp((s) => s.laborRule);
  const over5 = useApp((s) => s.store.over5Employees);
  return useMemo(
    () => employees.map((e) => ({ employee: e, payroll: calcPayroll(e, attendance, month, rule, over5) })),
    [employees, attendance, month, rule, over5],
  );
}

export function usePnl(month: string) {
  return usePnlSeries([month])[0];
}

/** 여러 달의 손익 (추이 차트용). 인건비는 각 달의 급여 계산 + 사업주 보험 */
export function usePnlSeries(months: string[]) {
  const sales = useApp((s) => s.sales);
  const store = useApp((s) => s.store);
  const expenses = useApp((s) => s.expenses);
  const recurring = useApp((s) => s.recurring);
  const employees = useApp((s) => s.employees);
  const attendance = useApp((s) => s.attendance);
  const rule = useApp((s) => s.laborRule);
  const { menuMap, unitCosts } = useMaps();
  const key = months.join(",");
  return useMemo(
    () =>
      key.split(",").map((month) => {
        const labor = employees.reduce((t, e) => {
          const p = calcPayroll(e, attendance, month, rule, store.over5Employees);
          return t + p.gross + p.employerInsurance;
        }, 0);
        return calcPnl({ month, sales, menus: menuMap, unitCosts, store, labor, expenses, recurring, openDays: businessDays(month, store.closedDays) });
      }),
    [key, sales, menuMap, unitCosts, store, expenses, recurring, employees, attendance, rule],
  );
}

export function useMenuAnalysis(days: number) {
  const sales = useApp((s) => s.sales);
  const menus = useApp((s) => s.menus);
  const store = useApp((s) => s.store);
  const reviews = useApp((s) => s.reviews);
  const { unitCosts } = useMaps();
  return useMemo(() => {
    const today = todayLocal();
    const from = addDays(today, -days);
    const inRange = sales.filter((l) => l.date >= from && l.date < today);
    const recentReviews = reviews.filter((r) => r.createdAt >= from);
    return analyzeMenus({ menus, sales: inRange, unitCosts, store, reviews: recentReviews, midDate: addDays(today, -Math.floor(days / 2)) });
  }, [sales, menus, store, reviews, unitCosts, days]);
}
