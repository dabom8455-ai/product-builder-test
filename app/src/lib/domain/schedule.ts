import type { Attendance, Employee, Shift } from "../types";
import { addDays, parseLocal, weekStart } from "../dates";
import { statutoryBreak, weeklyHolidayHours } from "./payroll";

const MIN = 60_000;
export const LATE_GRACE_MIN = 5;

export function shiftSpan(s: Pick<Shift, "date" | "start" | "end">): { startMs: number; endMs: number } {
  const startMs = parseLocal(`${s.date}T${s.start}`);
  let endMs = parseLocal(`${s.date}T${s.end}`);
  if (endMs <= startMs) endMs += 24 * 60 * MIN; // 자정을 넘기는 근무
  return { startMs, endMs };
}

/** 근무표 1칸의 유급 근무시간(분): 법정 휴게 제외 */
export function shiftWorkMinutes(s: Pick<Shift, "date" | "start" | "end">): number {
  const { startMs, endMs } = shiftSpan(s);
  const span = (endMs - startMs) / MIN;
  return span - statutoryBreak(span);
}

export type ShiftStatus = "ok" | "late" | "early" | "late-early" | "absent" | "working" | "upcoming";

export interface ShiftCheck {
  shift: Shift;
  status: ShiftStatus;
  lateMin: number;
  earlyMin: number;
  attendance?: Attendance;
}

/** 근무표와 출퇴근 기록 비교. today 이후(오늘 포함) 기록 없는 근무는 예정으로 본다. */
export function compareShifts(shifts: Shift[], attendance: Attendance[], today: string): ShiftCheck[] {
  return shifts.map((shift) => {
    const att = attendance.find((a) => a.employeeId === shift.employeeId && a.clockIn.slice(0, 10) === shift.date);
    if (!att) return { shift, status: shift.date < today ? "absent" : "upcoming", lateMin: 0, earlyMin: 0 };
    const { startMs, endMs } = shiftSpan(shift);
    const lateMin = Math.max(0, (parseLocal(att.clockIn) - startMs) / MIN);
    if (!att.clockOut) return { shift, status: "working", lateMin, earlyMin: 0, attendance: att };
    let outMs = parseLocal(att.clockOut);
    if (outMs < parseLocal(att.clockIn)) outMs += 24 * 60 * MIN;
    const earlyMin = Math.max(0, (endMs - outMs) / MIN);
    const late = lateMin > LATE_GRACE_MIN;
    const early = earlyMin > LATE_GRACE_MIN;
    const status: ShiftStatus = late && early ? "late-early" : late ? "late" : early ? "early" : "ok";
    return { shift, status, lateMin, earlyMin, attendance: att };
  });
}

export interface LaborForecast {
  employeeId: string;
  hours: number;
  basePay: number;
  weeklyHolidayPay: number;
  total: number;
  /** 주별 계획 시간 (월요일 → 시간) */
  weeks: { weekStart: string; hours: number }[];
  warnings: string[];
}

/** 근무표 기준 예상 인건비(세전). 주휴수당은 각 주의 계획 시간을 개근으로 가정해 계산한다. */
export function forecastLabor(emp: Employee, shifts: Shift[], from: string, to: string): LaborForecast {
  const mine = shifts.filter((s) => s.employeeId === emp.id && s.date >= from && s.date < to);
  const byWeek = new Map<string, number>();
  for (const s of mine) {
    const ws = weekStart(s.date);
    byWeek.set(ws, (byWeek.get(ws) ?? 0) + shiftWorkMinutes(s) / 60);
  }
  const weeks = [...byWeek.entries()].sort().map(([weekStart, hours]) => ({ weekStart, hours }));
  const hours = weeks.reduce((t, w) => t + w.hours, 0);
  const basePay = Math.round(hours * emp.hourlyWage);
  // 급여 계산(payroll.weeklyHolidayHours)과 같은 규칙: 계약시간이 있으면 그 기준, 계획이 계약에 못 미치면 0
  const weeklyHolidayPay = Math.round(weeks.reduce((t, w) => t + weeklyHolidayHours(emp.weeklyContractHours, w.hours), 0) * emp.hourlyWage);
  const warnings: string[] = [];
  for (const w of weeks) {
    if (emp.weeklyContractHours < 15 && w.hours >= 15)
      warnings.push(`${w.weekStart.slice(5)} 주: 계획 ${w.hours.toFixed(1)}시간 — 주 15시간 이상이면 주휴수당이 발생합니다(계약 ${emp.weeklyContractHours}시간).`);
    if (emp.weeklyContractHours > 0 && w.hours < emp.weeklyContractHours - 0.5)
      warnings.push(`${w.weekStart.slice(5)} 주: 계획 ${w.hours.toFixed(1)}시간이 계약 ${emp.weeklyContractHours}시간보다 적습니다.`);
    if (w.hours > 52) warnings.push(`${w.weekStart.slice(5)} 주: 주 52시간을 넘습니다.`);
  }
  return { employeeId: emp.id, hours, basePay, weeklyHolidayPay, total: basePay + weeklyHolidayPay, weeks, warnings };
}

/** 지난주 근무표를 이번 주로 복사 (같은 요일·시간). 이미 같은 직원·날짜에 근무가 있으면 건너뛴다. */
export function copyWeek(shifts: Shift[], fromWeekStart: string, toWeekStart: string, newId: () => string): Shift[] {
  const src = shifts.filter((s) => s.date >= fromWeekStart && s.date < addDays(fromWeekStart, 7));
  const offsetDays = Math.round((parseLocal(toWeekStart) - parseLocal(fromWeekStart)) / (24 * 60 * MIN));
  const out: Shift[] = [];
  for (const s of src) {
    const date = addDays(s.date, offsetDays);
    if (shifts.some((x) => x.employeeId === s.employeeId && x.date === date)) continue;
    out.push({ ...s, id: newId(), date });
  }
  return out;
}
