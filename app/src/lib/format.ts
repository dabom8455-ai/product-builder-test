export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
export const num = (n: number, digits = 0) => n.toLocaleString("ko-KR", { maximumFractionDigits: digits });
export const pct = (r: number, digits = 1) => `${(r * 100).toFixed(digits)}%`;
/** 만원 단위 축약: 1,234,000 → 123.4만 */
export const man = (n: number) => `${(n / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;
