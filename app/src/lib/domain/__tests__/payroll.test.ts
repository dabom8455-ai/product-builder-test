import { describe, expect, it } from "vitest";
import { calcPayroll, calcShift, nightMinutes, statutoryBreak, weeklyHolidayHours } from "../payroll";
import { parseLocal } from "../../dates";
import type { Attendance, Employee } from "../../types";

const rule = { minWage: 10320, employeeInsuranceRate: 0.1, employerInsuranceRate: 0.1, freelanceTaxRate: 0.033 };
const emp: Employee = { id: "e", name: "알바", hourlyWage: 10320, weeklyContractHours: 20, taxType: "freelance", contractSigned: true, pin: "1", active: true };

describe("payroll", () => {
  it("statutory break", () => {
    expect(statutoryBreak(239)).toBe(0);
    expect(statutoryBreak(240)).toBe(30);
    expect(statutoryBreak(9 * 60)).toBe(60);
  });

  it("night minutes across midnight", () => {
    expect(nightMinutes(parseLocal("2026-10-01T21:00"), parseLocal("2026-10-02T07:00"))).toBe(480);
    expect(nightMinutes(parseLocal("2026-10-01T03:00"), parseLocal("2026-10-01T05:00"))).toBe(120);
    expect(nightMinutes(parseLocal("2026-10-01T09:00"), parseLocal("2026-10-01T18:00"))).toBe(0);
  });

  it("shift uses explicit break when given", () => {
    const s = calcShift({ id: "a", employeeId: "e", clockIn: "2026-10-01T10:00", clockOut: "2026-10-01T14:30", breakMin: 30 })!;
    expect(s.workMin).toBe(240);
  });

  it("weekly holiday hours", () => {
    expect(weeklyHolidayHours(20, 20)).toBe(4);
    expect(weeklyHolidayHours(40, 40)).toBe(8);
    expect(weeklyHolidayHours(14, 14)).toBe(0);
    expect(weeklyHolidayHours(20, 16)).toBe(0); // 결근
    expect(weeklyHolidayHours(0, 30)).toBe(6);
  });

  it("monthly payroll with weekly holiday pay attributed by week end", () => {
    // 2026-10-05(월) ~ 10-09(금) 매일 4시간
    const att: Attendance[] = [5, 6, 7, 8, 9].map((d) => ({
      id: `a${d}`,
      employeeId: "e",
      clockIn: `2026-10-0${d}T10:00`,
      clockOut: `2026-10-0${d}T14:30`,
      breakMin: 30,
    }));
    const p = calcPayroll(emp, att, "2026-10", rule, false);
    expect(p.workHours).toBe(20);
    expect(p.basePay).toBe(206400);
    expect(p.weeklyHolidayPay).toBe(41280);
    expect(p.overtimePremium).toBe(0);
    expect(p.deduction).toBe(Math.round(247680 * 0.033));
  });

  it("premiums only for 5+ employee workplaces", () => {
    const att: Attendance[] = [{ id: "x", employeeId: "e", clockIn: "2026-10-05T13:00", clockOut: "2026-10-05T23:00", breakMin: 60 }];
    const small = calcPayroll(emp, att, "2026-10", rule, false);
    const big = calcPayroll(emp, att, "2026-10", rule, true);
    expect(small.overtimePremium + small.nightPremium).toBe(0);
    expect(big.overtimePremium).toBe(Math.round(1 * 10320 * 0.5));
    expect(big.nightPremium).toBe(Math.round(1 * 10320 * 0.5));
  });

  it("warns about minimum wage", () => {
    const p = calcPayroll({ ...emp, hourlyWage: 9000 }, [], "2026-10", rule, false);
    expect(p.warnings.some((w) => w.includes("최저시급"))).toBe(true);
  });
});
