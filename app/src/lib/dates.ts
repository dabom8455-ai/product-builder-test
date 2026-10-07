// 시간대 없는 로컬 날짜/시각 문자열 유틸. 내부 계산은 UTC 기준 ms로 해서 시간대 영향을 받지 않는다.

const DAY = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" 또는 "YYYY-MM-DDTHH:mm" → ms */
export function parseLocal(s: string): number {
  const [d, t = "00:00"] = s.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return Date.UTC(y, m - 1, day, hh || 0, mm || 0);
}

export function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return dateKey(parseLocal(date) + n * DAY);
}

/** 해당 날짜가 속한 주의 월요일 */
export function weekStart(date: string): string {
  const dow = new Date(parseLocal(date)).getUTCDay(); // 0=일
  return addDays(date, -((dow + 6) % 7));
}

export function dayOfWeek(date: string): number {
  return new Date(parseLocal(date)).getUTCDay();
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** 브라우저 현재 로컬 시각을 "YYYY-MM-DDTHH:mm" 으로 */
export function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function todayLocal(): string {
  return nowLocal().slice(0, 10);
}

export const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 그 달의 영업일 수 (정기 휴무 요일 제외) */
export function businessDays(month: string, closedDays: number[]): number {
  let n = 0;
  for (let d = 1; d <= daysInMonth(month); d++) {
    if (!closedDays.includes(dayOfWeek(`${month}-${String(d).padStart(2, "0")}`))) n++;
  }
  return n;
}
