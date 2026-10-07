/**
 * 날짜 유틸 — 모든 "오늘" 판정은 반드시 이 파일을 거친다.
 *
 * 서버(Vercel)는 UTC로 돌아간다. new Date() 를 그대로 쓰면
 * 한국 시각 00:00~08:59 사이의 기록이 "어제"로 저장된다.
 * 한국은 1988년 이후 서머타임이 없으므로 고정 +9h 로 계산해도 안전하다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** YYYY-MM-DD (날짜 전용 값의 포맷. 오프셋을 적용하지 않는다) */
function formatUTCDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 특정 시점(instant)이 한국에서 며칠인지 */
export function toKstDateString(instant: Date = new Date()): string {
  return formatUTCDate(new Date(instant.getTime() + KST_OFFSET_MS));
}

/** 한국 기준 오늘 (YYYY-MM-DD) */
export function todayKST(): string {
  return toKstDateString();
}

/** 한국 기준 현재 시각 (HH:MM) */
export function nowTimeKST(instant: Date = new Date()): string {
  const k = new Date(instant.getTime() + KST_OFFSET_MS);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

/** 'YYYY-MM-DD' → 날짜 연산용 Date (UTC 자정 기준) */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 날짜 문자열에 n일 더하기 (음수 가능) */
export function addDays(dateStr: string, n: number): string {
  return formatUTCDate(new Date(parseDate(dateStr).getTime() + n * 86400000));
}

/** 두 날짜 사이의 일수 (a - b) */
/** a − b (일). 뒤 날짜를 앞에 둬야 양수가 나온다: daysBetween(오늘, 마지막입력) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}

/** ISO 요일: 1=월 … 7=일 */
export function isoWeekday(dateStr: string): number {
  return ((parseDate(dateStr).getUTCDay() + 6) % 7) + 1;
}

export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

/** '월' '화' … 한 글자 요일 */
export function weekdayLabel(dateStr: string): string {
  return WEEKDAY_LABELS[isoWeekday(dateStr) - 1];
}

/** 최근 n일 (오래된 날짜 → 오늘 순). endDate 포함 */
export function recentDates(n: number, endDate: string = todayKST()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(endDate, -(n - 1 - i)));
}

/** 'YYYY-MM' (해당 월) */
export function yearMonth(dateStr: string = todayKST()): string {
  return dateStr.slice(0, 7);
}

/** 'M월 D일 (요일)' 표시용 */
export function displayDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}월 ${Number(d)}일 (${weekdayLabel(dateStr)})`;
}

/**
 * 취침~기상 수면 시간(분). 자정을 넘기는 경우를 처리한다.
 * 예) 21:30 → 07:00 = 570분
 */
export function sleepMinutes(sleepAt: string | null, wakeAt: string | null): number | null {
  if (!sleepAt || !wakeAt) return null;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
    return h * 60 + m;
  };
  const s = toMin(sleepAt);
  const w = toMin(wakeAt);
  if (Number.isNaN(s) || Number.isNaN(w)) return null;
  return w >= s ? w - s : 1440 - s + w;
}

/** 분 → '8시간 48분' */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
