import type { Pnl } from "./pnl";

export interface Scenario {
  /** 판매가 변화율 (0.05 = 5% 인상). 판매량은 따로 조정한다 */
  pricePct: number;
  /** 판매량 변화율 */
  volumePct: number;
  /** 월 인건비 증감(원) */
  laborDelta: number;
  /** 월 고정비 증감(원) */
  fixedDelta: number;
}

export const NO_CHANGE: Scenario = { pricePct: 0, volumePct: 0, laborDelta: 0, fixedDelta: 0 };

/**
 * 기준 월 손익에 시나리오를 적용한다.
 * - 가격: 매출·부가세·수수료가 비례해 변하고, 원가·포장재는 그대로
 * - 판매량: 매출·부가세·수수료·원가·포장재가 모두 비례해 변함
 */
export function applyScenario(p: Pnl, s: Scenario) {
  const price = 1 + s.pricePct;
  const vol = 1 + s.volumePct;
  const grossSales = p.grossSales * price * vol;
  const vat = p.vat * price * vol;
  const fees = p.fees * price * vol;
  const cogs = p.cogs * vol;
  const packaging = p.packaging * vol;
  const labor = Math.max(0, p.labor + s.laborDelta);
  const fixed = Math.max(0, p.fixed + s.fixedDelta);
  const variable = p.variable;
  const operatingProfit = grossSales - vat - fees - cogs - packaging - labor - fixed - variable;
  return { grossSales, vat, fees, cogs, packaging, labor, fixed, variable, operatingProfit, delta: operatingProfit - p.operatingProfit };
}

/** 가격을 pricePct 올렸을 때 순수익이 그대로 유지되는 판매량 감소 한계 (손익 무차별 판매량 변화율) */
export function breakEvenVolumeChange(p: Pnl, pricePct: number): number | null {
  // 공헌이익(매출 − 부가세 − 수수료 − 원가 − 포장재)이 같아지는 판매량
  const cmBase = p.grossSales - p.vat - p.fees - p.cogs - p.packaging;
  const price = 1 + pricePct;
  const cmPerVolAfter = (p.grossSales - p.vat - p.fees) * price - p.cogs - p.packaging;
  if (cmPerVolAfter <= 0) return null;
  return cmBase / cmPerVolAfter - 1;
}
