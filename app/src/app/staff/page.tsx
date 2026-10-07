"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/store";
import { usePayrolls } from "@/lib/hooks";
import type { Attendance, Employee, Shift, TaxType } from "@/lib/types";
import { calcShift, type PayrollResult } from "@/lib/domain/payroll";
import { addDays, addMonths, DOW_LABEL, dayOfWeek, nowLocal, todayLocal, weekStart } from "@/lib/dates";
import { compareShifts, copyWeek, forecastLabor, shiftWorkMinutes, type ShiftStatus } from "@/lib/domain/schedule";
import { Badge, Button, Card, Empty, Field, NumInput, PageHeader, Segmented, Stat, ic, inputCls } from "@/components/ui";
import { num, won } from "@/lib/format";
import { platform } from "@/lib/platform";
import { askConfirm } from "@/components/Confirm";

type Tab = "clock" | "schedule" | "records" | "payroll" | "people";
const TAX: Record<TaxType, string> = { insurance: "4대보험", freelance: "3.3%", none: "공제 없음" };

export default function StaffPage() {
  const [tab, setTab] = useState<Tab>("clock");
  return (
    <div>
      <PageHeader
        title="알바 근태"
        desc="상류 데이터 ③: 출퇴근 기록 → 급여·주휴수당 자동 계산 → 손익의 인건비에 자동 반영."
        right={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: "clock", label: "출퇴근" },
              { id: "schedule", label: "근무표" },
              { id: "records", label: "근무 기록" },
              { id: "payroll", label: "급여" },
              { id: "people", label: "직원" },
            ]}
          />
        }
      />
      {tab === "clock" && <Clock />}
      {tab === "schedule" && <Schedule />}
      {tab === "records" && <Records />}
      {tab === "payroll" && <Payroll />}
      {tab === "people" && <People />}
    </div>
  );
}

/** 매장 태블릿 키오스크: 직원이 자기 PIN으로 출퇴근을 찍는다 */
function Clock() {
  const employees = useApp((s) => s.employees).filter((e) => e.active);
  const attendance = useApp((s) => s.attendance);
  const upsert = useApp((s) => s.upsert);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const openShift = (empId: string) => attendance.find((a) => a.employeeId === empId && !a.clockOut);

  const submit = () => {
    if (!selected) return;
    if (pin !== selected.pin) {
      setMsg({ ok: false, text: "PIN이 맞지 않습니다." });
      setPin("");
      return;
    }
    const now = nowLocal();
    const open = openShift(selected.id);
    if (open) {
      upsert("attendance", { ...open, clockOut: now });
      const s = calcShift({ ...open, clockOut: now });
      setMsg({ ok: true, text: `${selected.name}님 퇴근 ${now.slice(11)} · 오늘 ${num((s?.workMin ?? 0) / 60, 1)}시간 근무 (휴게 ${s?.breakMin ?? 0}분 제외). 수고하셨어요!` });
    } else {
      upsert("attendance", { id: newId("at"), employeeId: selected.id, clockIn: now });
      setMsg({ ok: true, text: `${selected.name}님 출근 ${now.slice(11)} 기록되었습니다.` });
    }
    setSelected(null);
    setPin("");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="누가 출퇴근하나요?">
        {employees.length === 0 ? (
          <Empty>직원 탭에서 직원을 등록하세요.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {employees.map((e) => {
              const open = openShift(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => (setSelected(e), setMsg(null), setPin(""))}
                  className={`rounded-xl border p-4 text-left ${selected?.id === e.id ? "border-brand bg-brand/10" : "border-line"}`}
                >
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-xs text-ink-2">{open ? `근무 중 · ${open.clockIn.slice(11)} 출근` : "출근 전"}</div>
                </button>
              );
            })}
          </div>
        )}
        {msg && <p className={`mt-4 rounded-lg p-3 text-sm ${msg.ok ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}>{msg.text}</p>}
      </Card>
      {selected && (
        <Card title={`${selected.name} · ${openShift(selected.id) ? "퇴근" : "출근"}`}>
          <div className="mb-3 text-center text-3xl tracking-[0.5em] tabular">{pin.padEnd(4, "·")}</div>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "확인"].map((k) => (
              <button
                key={k}
                className={`rounded-xl py-4 text-lg font-semibold ${k === "확인" ? "bg-brand text-brand-ink" : "bg-surface-2"}`}
                onClick={() => (k === "←" ? setPin(pin.slice(0, -1)) : k === "확인" ? submit() : pin.length < 6 && setPin(pin + k))}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-2">매장 태블릿에 이 화면을 띄워 두세요. 기록 시각은 이 기기의 현재 시각입니다.</p>
        </Card>
      )}
    </div>
  );
}

function Records() {
  const employees = useApp((s) => s.employees);
  const attendance = useApp((s) => s.attendance);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [emp, setEmp] = useState<string>("all");
  const list = attendance
    .filter((a) => a.clockIn.startsWith(month) && (emp === "all" || a.employeeId === emp))
    .sort((a, b) => b.clockIn.localeCompare(a.clockIn));

  const add = () => {
    const d = todayLocal();
    upsert("attendance", { id: newId("at"), employeeId: emp === "all" ? employees[0]?.id : emp, clockIn: `${d}T10:00`, clockOut: `${d}T14:00` });
  };

  return (
    <Card
      title="근무 기록"
      right={
        <div className="flex flex-wrap gap-2">
          <select className={ic("w-32")} value={emp} onChange={(e) => setEmp(e.target.value)}>
            <option value="all">전체 직원</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <input type="month" className={ic("w-40")} value={month} onChange={(e) => setMonth(e.target.value)} />
          <Button size="sm" onClick={add} disabled={employees.length === 0}>
            + 수기 추가
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-ink-2">휴게시간을 비워두면 법정 최소 휴게(4시간 이상 30분, 8시간 30분 이상 근무 시 60분)가 자동 적용됩니다.</p>
      {list.length === 0 ? (
        <Empty>기록이 없습니다.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular">
            <thead className="text-xs text-ink-2">
              <tr>
                <th className="text-left font-normal">직원</th>
                <th className="text-left font-normal">출근</th>
                <th className="text-left font-normal">퇴근</th>
                <th className="text-right font-normal">휴게(분)</th>
                <th className="text-right font-normal">근무</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const s = calcShift(a);
                return (
                  <tr key={a.id} className="border-t border-line/60">
                    <td className="py-1.5 pr-2">
                      <select className={ic("py-1")} value={a.employeeId} onChange={(e) => upsert("attendance", { ...a, employeeId: e.target.value })}>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="pr-2">
                      <input type="datetime-local" className={ic("py-1")} value={a.clockIn} onChange={(e) => e.target.value && upsert("attendance", { ...a, clockIn: e.target.value })} />
                      <span className="ml-1 text-xs text-ink-2">{DOW_LABEL[dayOfWeek(a.clockIn.slice(0, 10))]}</span>
                    </td>
                    <td className="pr-2">
                      <input type="datetime-local" className={ic("py-1")} value={a.clockOut ?? ""} onChange={(e) => upsert("attendance", { ...a, clockOut: e.target.value || undefined })} />
                    </td>
                    <td className="text-right">
                      <input
                        type="number"
                        className={ic("w-20 py-1 text-right")}
                        placeholder={s ? `자동 ${s.breakMin}` : "자동"}
                        value={a.breakMin ?? ""}
                        onChange={(e) => upsert("attendance", { ...a, breakMin: e.target.value === "" ? undefined : Number(e.target.value) })}
                      />
                    </td>
                    <td className="text-right">{s ? `${num(s.workMin / 60, 2)}h` : <Badge tone="warn">근무 중</Badge>}</td>
                    <td className="pl-2 text-right">
                      <button className="text-ink-2 hover:text-bad" aria-label="삭제" onClick={async () => (await askConfirm("근무 기록을 삭제할까요?", { confirmLabel: "삭제", danger: true })) && remove("attendance", a.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Payroll() {
  const [month, setMonth] = useState(addMonths(todayLocal().slice(0, 7), -1));
  const payrolls = usePayrolls(month);
  const over5 = useApp((s) => s.store.over5Employees);
  const [slip, setSlip] = useState<string | null>(null);
  const total = payrolls.reduce(
    (t, { payroll: p }) => ({ gross: t.gross + p.gross, net: t.net + p.net, employer: t.employer + p.employerInsurance }),
    { gross: 0, net: 0, employer: 0 },
  );
  const slipData = payrolls.find((p) => p.employee.id === slip);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))}>
          ◀
        </Button>
        <span className="w-24 text-center font-semibold tabular">{month}</span>
        <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}>
          ▶
        </Button>
        <span className="text-xs text-ink-2">{over5 ? "5인 이상 사업장: 연장·야간 가산 적용" : "5인 미만 사업장: 연장·야간 가산 미적용"}</span>
      </div>
      <div className="no-print grid grid-cols-3 gap-3">
        <Stat label="총 지급액(세전)" value={won(total.gross)} />
        <Stat label="실지급액" value={won(total.net)} />
        <Stat label="사업주 보험 부담(추정)" value={won(total.employer)} />
      </div>
      <Card title="직원별 급여" className="no-print">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm tabular">
            <thead className="text-xs text-ink-2">
              <tr>
                <th className="text-left font-normal">직원</th>
                <th className="text-right font-normal">근무시간</th>
                <th className="text-right font-normal">기본급</th>
                <th className="text-right font-normal">주휴수당</th>
                <th className="text-right font-normal">가산수당</th>
                <th className="text-right font-normal">공제</th>
                <th className="text-right font-normal">실지급</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payrolls.map(({ employee: e, payroll: p }) => (
                <tr key={e.id} className="border-t border-line/60">
                  <td className="py-2">
                    {e.name} <span className="text-xs text-ink-2">{TAX[e.taxType]}</span>
                    {p.warnings.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.warnings.map((w) => (
                          <Badge key={w} tone="warn">
                            {w}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-right">{num(p.workHours, 1)}h</td>
                  <td className="text-right">{won(p.basePay)}</td>
                  <td className="text-right">{won(p.weeklyHolidayPay)}</td>
                  <td className="text-right">{won(p.overtimePremium + p.nightPremium)}</td>
                  <td className="text-right">{won(p.deduction)}</td>
                  <td className="text-right font-semibold">{won(p.net)}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSlip(e.id)}>
                      명세서
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-ink-2">
          주휴수당: 주 소정근로 15시간 이상 & 개근 시 (소정근로시간 ÷ 40) × 8시간 × 시급. 주휴·주 40시간 초과분은 해당 주의 일요일이 속한 달에 반영합니다. 4대보험 공제율은 추정치이며 설정에서 조정할 수 있습니다. 정확한 노무 판단은 노무사와 상담하세요.
        </p>
      </Card>
      {slipData && <Payslip employee={slipData.employee} p={slipData.payroll} onClose={() => setSlip(null)} />}
    </div>
  );
}

function Payslip({ employee, p, onClose }: { employee: Employee; p: PayrollResult; onClose: () => void }) {
  const storeName = useApp((s) => s.store.name);
  const rows: [string, string][] = [
    ["기본급", `${won(p.basePay)} (${num(p.workHours, 2)}시간 × ${won(employee.hourlyWage)})`],
    ["주휴수당", `${won(p.weeklyHolidayPay)} (${p.weeks.filter((w) => w.weeklyHolidayHours > 0).length}주)`],
    ["연장근로 가산", won(p.overtimePremium)],
    ["야간근로 가산", won(p.nightPremium)],
    ["지급 합계", won(p.gross)],
    [`공제 (${TAX[employee.taxType]})`, won(p.deduction)],
    ["실지급액", won(p.net)],
  ];
  return (
    <Card
      title={`임금명세서 — ${employee.name} (${p.month})`}
      right={
        <div className="no-print flex gap-2">
          {platform().canPrint && (
            <Button size="sm" onClick={() => window.print()}>
              인쇄 / PDF
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-2">사업장: {storeName}</p>
      <table className="mt-3 w-full text-sm tabular">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-line/60">
              <td className="py-1.5">{k}</td>
              <td className="text-right">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="mt-4 mb-1 text-sm font-semibold">근무 내역</h3>
      <table className="w-full text-xs tabular">
        <tbody>
          {p.shifts
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s, i) => (
              <tr key={i} className="border-b border-line/40">
                <td className="py-1">
                  {s.date} ({DOW_LABEL[dayOfWeek(s.date)]})
                </td>
                <td className="text-right">휴게 {s.breakMin}분</td>
                <td className="text-right">{num(s.workMin / 60, 2)}시간</td>
              </tr>
            ))}
        </tbody>
      </table>
    </Card>
  );
}

function People() {
  const employees = useApp((s) => s.employees);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const minWage = useApp((s) => s.laborRule.minWage);
  const attendance = useApp((s) => s.attendance);
  const sorted = useMemo(() => [...employees].sort((a, b) => Number(b.active) - Number(a.active)), [employees]);

  const add = () =>
    upsert("employees", {
      id: newId("e"),
      name: "새 직원",
      hourlyWage: minWage,
      weeklyContractHours: 15,
      taxType: "freelance",
      contractSigned: false,
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      active: true,
    });

  return (
    <div className="space-y-3">
      <div className="text-right">
        <Button onClick={add}>+ 직원 추가</Button>
      </div>
      {sorted.map((e) => {
        const save = (patch: Partial<Employee>) => upsert("employees", { ...e, ...patch });
        return (
          <Card key={e.id} className={e.active ? "" : "opacity-60"}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="이름">
                <input className={inputCls} value={e.name} onChange={(ev) => save({ name: ev.target.value })} />
              </Field>
              <Field label="시급" hint={e.hourlyWage < minWage ? `최저시급 ${won(minWage)} 미만!` : undefined}>
                <NumInput value={e.hourlyWage} step={10} onChange={(n) => save({ hourlyWage: n })} />
              </Field>
              <Field label="주 소정근로시간" hint="주휴수당 판단 기준">
                <NumInput value={e.weeklyContractHours} step={0.5} onChange={(n) => save({ weeklyContractHours: n })} />
              </Field>
              <Field label="공제 방식">
                <select className={inputCls} value={e.taxType} onChange={(ev) => save({ taxType: ev.target.value as TaxType })}>
                  {(Object.keys(TAX) as TaxType[]).map((t) => (
                    <option key={t} value={t}>
                      {TAX[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="출퇴근 PIN">
                <input className={inputCls} inputMode="numeric" value={e.pin} onChange={(ev) => save({ pin: ev.target.value.replace(/\D/g, "").slice(0, 6) })} />
              </Field>
              <Field label="보건증 만료일">
                <input type="date" className={inputCls} value={e.healthCertExpiry ?? ""} onChange={(ev) => save({ healthCertExpiry: ev.target.value || undefined })} />
              </Field>
              <Field label="근로계약서">
                <select className={inputCls} value={e.contractSigned ? "1" : "0"} onChange={(ev) => save({ contractSigned: ev.target.value === "1" })}>
                  <option value="1">작성 완료</option>
                  <option value="0">미작성</option>
                </select>
              </Field>
              <Field label="상태">
                <select className={inputCls} value={e.active ? "1" : "0"} onChange={(ev) => save({ active: ev.target.value === "1" })}>
                  <option value="1">재직</option>
                  <option value="0">퇴사</option>
                </select>
              </Field>
            </div>
            <div className="mt-3 text-right">
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  const n = attendance.filter((a: Attendance) => a.employeeId === e.id).length;
                  const msg = n ? `근무 기록 ${n}건이 있습니다. 삭제 대신 ‘퇴사’ 처리를 권장합니다. 그래도 삭제할까요?` : `${e.name} 직원을 삭제할까요?`;
                  if (await askConfirm(msg, { confirmLabel: "삭제", danger: true })) remove("employees", e.id);
                }}
              >
                삭제
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const STATUS: Record<ShiftStatus, { label: string; tone?: "good" | "bad" | "warn" | "brand" }> = {
  ok: { label: "정상", tone: "good" },
  late: { label: "지각", tone: "warn" },
  early: { label: "조퇴", tone: "warn" },
  "late-early": { label: "지각·조퇴", tone: "warn" },
  absent: { label: "결근", tone: "bad" },
  working: { label: "근무 중", tone: "brand" },
  upcoming: { label: "예정" },
};

/** 주간 근무표: 계획을 세우고, 출퇴근 기록과 비교하고, 인건비를 미리 본다 */
function Schedule() {
  const employees = useApp((s) => s.employees).filter((e) => e.active);
  const shifts = useApp((s) => s.shifts);
  const attendance = useApp((s) => s.attendance);
  const addShifts = useApp((s) => s.addShifts);
  const today = todayLocal();
  const [ws, setWs] = useState(weekStart(today));
  const [editing, setEditing] = useState<{ employeeId: string; date: string; shift?: Shift } | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekShifts = shifts.filter((s) => s.date >= ws && s.date < addDays(ws, 7));
  const checks = useMemo(() => compareShifts(weekShifts, attendance, today), [weekShifts, attendance, today]);
  const checkOf = (id: string) => checks.find((c) => c.shift.id === id);
  const issues = checks.filter((c) => ["late", "early", "late-early", "absent"].includes(c.status));

  const month = today.slice(0, 7);
  const forecasts = useMemo(
    () =>
      employees.map((e) => ({
        e,
        week: forecastLabor(e, shifts, ws, addDays(ws, 7)),
        month: forecastLabor(e, shifts, `${month}-01`, `${addMonths(month, 1)}-01`),
      })),
    [employees, shifts, ws, month],
  );
  const weekTotal = forecasts.reduce((t, f) => t + f.week.total, 0);
  const monthTotal = forecasts.reduce((t, f) => t + f.month.total, 0);
  const prevWeekHas = shifts.some((s) => s.date >= addDays(ws, -7) && s.date < ws);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setWs(addDays(ws, -7))} aria-label="이전 주">
          ◀
        </Button>
        <span className="text-center font-semibold tabular">
          {ws.slice(5)} ~ {addDays(ws, 6).slice(5)}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setWs(addDays(ws, 7))} aria-label="다음 주">
          ▶
        </Button>
        {ws !== weekStart(today) && (
          <Button size="sm" variant="ghost" onClick={() => setWs(weekStart(today))}>
            이번 주
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={!prevWeekHas}
          onClick={() => addShifts(copyWeek(shifts, addDays(ws, -7), ws, () => newId("sh")))}
        >
          지난주 근무표 복사
        </Button>
      </div>

      <Card>
        {employees.length === 0 ? (
          <Empty>직원 탭에서 직원을 먼저 등록하세요.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed text-xs">
              <thead>
                <tr className="text-ink-2">
                  <th className="w-20 text-left font-normal">직원</th>
                  {days.map((d) => (
                    <th key={d} className={`font-normal ${d === today ? "text-brand font-semibold" : dayOfWeek(d) === 0 ? "text-bad" : ""}`}>
                      {DOW_LABEL[dayOfWeek(d)]} {d.slice(8)}
                    </th>
                  ))}
                  <th className="w-16 text-right font-normal">계획</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const f = forecasts.find((x) => x.e.id === e.id)!;
                  return (
                    <tr key={e.id} className="border-t border-line/60 align-top">
                      <td className="py-1.5 font-medium">{e.name}</td>
                      {days.map((d) => {
                        const list = weekShifts.filter((s) => s.employeeId === e.id && s.date === d);
                        return (
                          <td key={d} className="p-0.5">
                            <div className="flex min-h-12 flex-col gap-0.5">
                              {list.map((s) => {
                                const st = STATUS[checkOf(s.id)?.status ?? "upcoming"];
                                return (
                                  <button key={s.id} onClick={() => setEditing({ employeeId: e.id, date: d, shift: s })} className="rounded-md bg-brand/10 px-1 py-1 text-left hover:bg-brand/20">
                                    <div className="tabular">
                                      {s.start}~{s.end}
                                    </div>
                                    {st.label !== "예정" && <Badge tone={st.tone}>{st.label}</Badge>}
                                  </button>
                                );
                              })}
                              <button onClick={() => setEditing({ employeeId: e.id, date: d })} className="rounded-md border border-dashed border-line py-0.5 text-ink-2 hover:border-brand" aria-label={`${e.name} ${d} 근무 추가`}>
                                +
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-right tabular">
                        {num(f.week.hours, 1)}h
                        {e.weeklyContractHours > 0 && <div className="text-ink-2">/{e.weeklyContractHours}h</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {editing && <ShiftEditor key={`${editing.employeeId}-${editing.date}-${editing.shift?.id ?? "new"}`} {...editing} onClose={() => setEditing(null)} />}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="예상 인건비 (근무표 기준)">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="이번 주(선택한 주)" value={won(weekTotal)} />
            <Stat label={`${month.slice(5)}월 전체`} value={won(monthTotal)} sub="주휴수당 포함, 세전" />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {forecasts.map(({ e, month: m }) => (
              <li key={e.id} className="flex justify-between gap-2 tabular">
                <span>{e.name}</span>
                <span>
                  {num(m.hours, 1)}h · {won(m.total)}
                </span>
              </li>
            ))}
          </ul>
          {forecasts.some((f) => f.week.warnings.length) && (
            <ul className="mt-3 space-y-1">
              {forecasts.flatMap((f) =>
                f.week.warnings.map((w) => (
                  <li key={f.e.id + w}>
                    <Badge tone="warn">
                      {f.e.name}: {w}
                    </Badge>
                  </li>
                )),
              )}
            </ul>
          )}
        </Card>
        <Card title="계획 vs 실제 (이번 주)">
          {issues.length === 0 ? (
            <p className="text-sm text-ink-2">지각·조퇴·결근이 없습니다.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {issues.map((c) => (
                <li key={c.shift.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                  <span>
                    {employees.find((e) => e.id === c.shift.employeeId)?.name} · {c.shift.date.slice(5)} ({DOW_LABEL[dayOfWeek(c.shift.date)]}) {c.shift.start}~{c.shift.end}
                  </span>
                  <span className="text-xs text-ink-2">
                    {c.lateMin > 5 && `${Math.round(c.lateMin)}분 늦음`} {c.earlyMin > 5 && `${Math.round(c.earlyMin)}분 일찍 퇴근`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink-2">출근이 예정보다 5분 넘게 늦으면 지각, 퇴근이 5분 넘게 이르면 조퇴, 지난 날짜에 출근 기록이 없으면 결근으로 표시합니다.</p>
        </Card>
      </div>
    </div>
  );
}

function ShiftEditor({ employeeId, date, shift, onClose }: { employeeId: string; date: string; shift?: Shift; onClose: () => void }) {
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const name = useApp((s) => s.employees.find((e) => e.id === employeeId)?.name);
  const [start, setStart] = useState(shift?.start ?? "10:00");
  const [end, setEnd] = useState(shift?.end ?? "15:00");
  const minutes = shiftWorkMinutes({ date, start, end });
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 p-3">
      <div className="text-sm font-medium">
        {name} · {date} ({DOW_LABEL[dayOfWeek(date)]})
      </div>
      <Field label="시작">
        <input type="time" className={ic("w-32")} value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="종료">
        <input type="time" className={ic("w-32")} value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <span className="pb-2 text-xs text-ink-2">유급 {num(minutes / 60, 1)}시간 (법정 휴게 제외)</span>
      <div className="ml-auto flex gap-2">
        {shift && (
          <Button size="sm" variant="danger" onClick={() => (remove("shifts", shift.id), onClose())}>
            삭제
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button
          size="sm"
          disabled={!start || !end || start === end}
          onClick={() => {
            upsert("shifts", { id: shift?.id ?? newId("sh"), employeeId, date, start, end });
            onClose();
          }}
        >
          저장
        </Button>
      </div>
    </div>
  );
}
