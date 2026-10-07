import type { Attendance, Employee, Menu, Review, SaleLine, Shift, Store } from "../types";
import { addDays, dayOfWeek, parseLocal } from "../dates";

export interface Todo {
  id: string;
  level: "urgent" | "normal" | "info";
  text: string;
  href: string;
}

/** 홈의 "오늘 할 일": 데이터에서 자동으로 만든 체크리스트 */
export function buildTodos(args: {
  today: string;
  store: Store;
  sales: SaleLine[];
  reviews: Review[];
  attendance: Attendance[];
  employees: Employee[];
  shifts: Shift[];
  menus: Menu[];
  unitCosts: Map<string, number>;
}): Todo[] {
  const { today, store } = args;
  const out: Todo[] = [];
  const yesterday = addDays(today, -1);

  if (!store.closedDays.includes(dayOfWeek(yesterday)) && !args.sales.some((l) => l.date === yesterday) && args.menus.length > 0)
    out.push({ id: "close", level: "urgent", text: `어제(${yesterday.slice(5)}) 매출 마감이 입력되지 않았습니다.`, href: "/sales" });

  const negPending = args.reviews.filter((r) => r.status !== "posted" && r.sentiment === "negative");
  if (negPending.length) out.push({ id: "neg", level: "urgent", text: `부정 리뷰 ${negPending.length}건에 답글을 달아 주세요.`, href: "/reviews" });
  const otherPending = args.reviews.filter((r) => r.status !== "posted" && r.sentiment !== "negative");
  if (otherPending.length) out.push({ id: "rev", level: "normal", text: `답글 대기 리뷰 ${otherPending.length}건`, href: "/reviews" });

  const open = args.attendance.filter((a) => !a.clockOut && a.clockIn.slice(0, 10) < today);
  for (const a of open) {
    const name = args.employees.find((e) => e.id === a.employeeId)?.name ?? "직원";
    out.push({ id: `open-${a.id}`, level: "urgent", text: `${name}님 ${a.clockIn.slice(5, 10)} 퇴근 기록이 없습니다.`, href: "/staff" });
  }

  for (const e of args.employees.filter((x) => x.active)) {
    if (e.healthCertExpiry) {
      const days = Math.round((parseLocal(e.healthCertExpiry) - parseLocal(today)) / 86_400_000);
      if (days < 0) out.push({ id: `hc-${e.id}`, level: "urgent", text: `${e.name}님 보건증이 만료되었습니다(${e.healthCertExpiry}).`, href: "/staff" });
      else if (days <= 30) out.push({ id: `hc-${e.id}`, level: "normal", text: `${e.name}님 보건증 만료 ${days}일 전 (${e.healthCertExpiry})`, href: "/staff" });
    }
    if (!e.contractSigned) out.push({ id: `ct-${e.id}`, level: "normal", text: `${e.name}님 근로계약서를 작성해 주세요.`, href: "/staff" });
  }

  for (const m of args.menus) {
    if (m.isSub || !m.active || m.price <= 0) continue;
    const target = m.category === "drink" ? store.targetCostRatio.drink : store.targetCostRatio.dessert;
    const ratio = (args.unitCosts.get(m.id) ?? 0) / m.price;
    if (ratio > target) out.push({ id: `cost-${m.id}`, level: "normal", text: `${m.name} 원가율 ${(ratio * 100).toFixed(0)}% — 목표 ${(target * 100).toFixed(0)}% 초과`, href: "/menu" });
  }

  const todayShifts = args.shifts.filter((s) => s.date === today).sort((a, b) => a.start.localeCompare(b.start));
  if (todayShifts.length) {
    const names = todayShifts.map((s) => `${args.employees.find((e) => e.id === s.employeeId)?.name ?? "?"} ${s.start}~${s.end}`);
    out.push({ id: "shifts", level: "info", text: `오늘 근무: ${names.join(", ")}`, href: "/staff" });
  }

  const order = { urgent: 0, normal: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
