import type { Attendance, Employee, LaborRule } from "../types";
import { addDays, parseLocal, weekStart } from "../dates";

// 시간 문자열은 시간대 없는 로컬 벽시계 "YYYY-MM-DDTHH:mm" 형식을 쓴다.
// 매장 기준 시각이므로 브라우저/서버 시간대에 따라 값이 흔들리지 않는다.

const MIN = 60_000;

/** 법정 최소 휴게: 근로 4시간 이상 30분, 8시간 이상 1시간 (근로기준법 제54조) */
export function statutoryBreak(spanMin: number): number {
  if (spanMin >= 8 * 60 + 30) return 60;
  if (spanMin >= 4 * 60) return 30;
  return 0;
}

/** [start,end) 구간 중 22:00~06:00 에 걸친 분 */
export function nightMinutes(startMs: number, endMs: number): number {
  let total = 0;
  const day = 24 * 60 * MIN;
  const firstMidnight = Math.floor(startMs / day) * day;
  for (let d = firstMidnight - day; d < endMs; d += day) {
    // 당일 22:00 ~ 익일 06:00
    const ns = d + 22 * 60 * MIN;
    const ne = d + 30 * 60 * MIN;
    const s = Math.max(startMs, ns);
    const e = Math.min(endMs, ne);
    if (e > s) total += (e - s) / MIN;
  }
  return total;
}

export interface ShiftCalc {
  date: string;
  spanMin: number;
  breakMin: number;
  workMin: number;
  nightMin: number;
  dailyOvertimeMin: number;
}

export function calcShift(a: Attendance): ShiftCalc | null {
  if (!a.clockOut) return null;
  const s = parseLocal(a.clockIn);
  const e = parseLocal(a.clockOut);
  if (!(e > s)) return null;
  const spanMin = (e - s) / MIN;
  const breakMin = Math.min(spanMin, a.breakMin ?? statutoryBreak(spanMin));
  const workMin = spanMin - breakMin;
  return {
    date: a.clockIn.slice(0, 10),
    spanMin,
    breakMin,
    workMin,
    nightMin: Math.min(workMin, nightMinutes(s, e)),
    dailyOvertimeMin: Math.max(0, workMin - 8 * 60),
  };
}

export interface WeekCalc {
  weekStart: string; // 월요일
  weekEnd: string; // 일요일
  workMin: number;
  weeklyHolidayHours: number;
  /** 일 8시간 초과분과 별개로, 주 40시간 초과로 추가되는 연장 분 */
  extraWeeklyOvertimeMin: number;
}

/** 주휴수당 대상 시간: 주 소정근로 15시간 이상 & 개근 시 (소정근로/40)×8, 최대 8시간 */
export function weeklyHolidayHours(contractHours: number, actualHours: number): number {
  const basis = contractHours > 0 ? contractHours : actualHours;
  if (basis < 15) return 0;
  // 계약시간이 있으면 실근무가 계약시간에 (30분 허용오차 내로) 미치지 못하면 결근으로 본다
  if (contractHours > 0 && actualHours < contractHours - 0.5) return 0;
  return (Math.min(basis, 40) / 40) * 8;
}

export interface PayrollResult {
  employeeId: string;
  month: string;
  shifts: ShiftCalc[];
  weeks: WeekCalc[];
  workHours: number;
  basePay: number;
  weeklyHolidayPay: number;
  overtimePremium: number;
  nightPremium: number;
  gross: number;
  deduction: number;
  net: number;
  employerInsurance: number;
  warnings: string[];
}

export function calcPayroll(
  emp: Employee,
  attendances: Attendance[],
  month: string, // YYYY-MM
  rule: LaborRule,
  over5Employees: boolean,
): PayrollResult {
  const mine = attendances.filter((a) => a.employeeId === emp.id);
  const all = mine.map(calcShift).filter((x): x is ShiftCalc => x !== null);
  const shifts = all.filter((s) => s.date.startsWith(month));

  // 주 단위 항목(주휴·주40시간 초과)은 그 주의 일요일이 속한 달로 귀속한다
  const byWeek = new Map<string, ShiftCalc[]>();
  for (const s of all) {
    const ws = weekStart(s.date);
    const list = byWeek.get(ws) ?? [];
    list.push(s);
    byWeek.set(ws, list);
  }
  const weeks: WeekCalc[] = [];
  for (const [ws, list] of [...byWeek.entries()].sort()) {
    const we = addDays(ws, 6);
    if (!we.startsWith(month)) continue;
    const workMin = list.reduce((t, s) => t + s.workMin, 0);
    const dailyOt = list.reduce((t, s) => t + s.dailyOvertimeMin, 0);
    weeks.push({
      weekStart: ws,
      weekEnd: we,
      workMin,
      weeklyHolidayHours: weeklyHolidayHours(emp.weeklyContractHours, workMin / 60),
      extraWeeklyOvertimeMin: Math.max(0, workMin - 40 * 60 - dailyOt),
    });
  }

  const wage = emp.hourlyWage;
  const workMin = shifts.reduce((t, s) => t + s.workMin, 0);
  const basePay = Math.round((workMin / 60) * wage);
  const weeklyHolidayPay = Math.round(weeks.reduce((t, w) => t + w.weeklyHolidayHours, 0) * wage);

  let overtimePremium = 0;
  let nightPremium = 0;
  if (over5Employees) {
    const otMin =
      shifts.reduce((t, s) => t + s.dailyOvertimeMin, 0) +
      weeks.reduce((t, w) => t + w.extraWeeklyOvertimeMin, 0);
    overtimePremium = Math.round((otMin / 60) * wage * 0.5);
    nightPremium = Math.round((shifts.reduce((t, s) => t + s.nightMin, 0) / 60) * wage * 0.5);
  }

  const gross = basePay + weeklyHolidayPay + overtimePremium + nightPremium;
  const rate =
    emp.taxType === "insurance"
      ? rule.employeeInsuranceRate
      : emp.taxType === "freelance"
        ? rule.freelanceTaxRate
        : 0;
  const deduction = Math.round(gross * rate);
  const employerInsurance = emp.taxType === "insurance" ? Math.round(gross * rule.employerInsuranceRate) : 0;

  const warnings: string[] = [];
  if (wage < rule.minWage) warnings.push(`시급 ${wage.toLocaleString()}원이 최저시급 ${rule.minWage.toLocaleString()}원 미만입니다.`);
  if (!emp.contractSigned) warnings.push("근로계약서 미작성 상태입니다.");
  if (emp.weeklyContractHours >= 14 && emp.weeklyContractHours < 15)
    warnings.push("주 소정근로시간이 15시간 경계에 근접합니다(15시간 이상 시 주휴수당 발생).");
  if (emp.healthCertExpiry) {
    const days = (parseLocal(emp.healthCertExpiry + "T00:00") - parseLocal(`${month}-01T00:00`)) / (24 * 60 * MIN);
    if (days < 31) warnings.push(`보건증 만료(예정)일: ${emp.healthCertExpiry}`);
  }
  return {
    employeeId: emp.id,
    month,
    shifts,
    weeks,
    workHours: workMin / 60,
    basePay,
    weeklyHolidayPay,
    overtimePremium,
    nightPremium,
    gross,
    deduction,
    net: gross - deduction,
    employerInsurance,
    warnings,
  };
}
