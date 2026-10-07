import type { Channel, Expense, Menu, RecurringExpense, SaleLine, Store } from "../types";
import { CHANNELS } from "../types";
import { netOfVat } from "./cost";
import { daysInMonth } from "../dates";

export interface ChannelSummary {
  channel: Channel;
  sales: number;
  qty: number;
  fee: number;
  cogs: number;
  margin: number;
}

export interface Pnl {
  month: string;
  grossSales: number;
  vat: number;
  netSales: number;
  cogs: number;
  fees: number;
  packaging: number;
  grossProfit: number;
  labor: number;
  fixed: number;
  variable: number;
  operatingProfit: number;
  orders: number;
  qty: number;
  byChannel: ChannelSummary[];
  /** 손익분기 월 매출 (공헌이익률 기준) */
  breakEvenSales: number;
  breakEvenDailySales: number;
}

export function linePrice(menu: Menu, channel: Channel): number {
  const delivery = CHANNELS.find((c) => c.id === channel)?.delivery;
  return delivery ? menu.deliveryPrice || menu.price : menu.price;
}

export function calcPnl(args: {
  month: string;
  sales: SaleLine[];
  menus: Map<string, Menu>;
  unitCosts: Map<string, number>;
  store: Store;
  labor: number;
  expenses: Expense[];
  recurring: RecurringExpense[];
  /** 손익분기 하루 매출 계산에 쓰는 영업일 수 (기본: 그 달 전체 일수) */
  openDays?: number;
}): Pnl {
  const { month, store } = args;
  const lines = args.sales.filter((s) => s.date.startsWith(month));
  const byChannel = new Map<Channel, ChannelSummary>();
  let grossSales = 0;
  let cogs = 0;
  let fees = 0;
  let packaging = 0;
  let qty = 0;
  const orderKeys = new Set<string>();

  for (const l of lines) {
    const menu = args.menus.get(l.menuId);
    if (!menu) continue;
    const isDelivery = CHANNELS.find((c) => c.id === l.channel)?.delivery ?? false;
    const sales = linePrice(menu, l.channel) * l.qty;
    const cost = (args.unitCosts.get(menu.id) ?? 0) * l.qty;
    const fee = sales * (store.channelFeeRate[l.channel] ?? 0);
    const pack = isDelivery ? store.deliveryPackagingCost * l.qty : 0;
    grossSales += sales;
    cogs += cost;
    fees += fee;
    packaging += pack;
    qty += l.qty;
    orderKeys.add(`${l.date}:${l.channel}`);
    const c = byChannel.get(l.channel) ?? { channel: l.channel, sales: 0, qty: 0, fee: 0, cogs: 0, margin: 0 };
    c.sales += sales;
    c.qty += l.qty;
    c.fee += fee;
    c.cogs += cost + pack;
    c.margin += netOfVat(sales, store.vatMode) - fee - cost - pack;
    byChannel.set(l.channel, c);
  }

  const netSales = netOfVat(grossSales, store.vatMode);
  const vat = grossSales - netSales;
  const grossProfit = netSales - cogs - fees - packaging;
  const monthExp = args.expenses.filter((e) => e.month === month);
  const fixed =
    args.recurring.reduce((t, e) => t + e.amount, 0) +
    monthExp.filter((e) => e.category === "fixed").reduce((t, e) => t + e.amount, 0);
  const variable = monthExp.filter((e) => e.category === "variable").reduce((t, e) => t + e.amount, 0);
  const operatingProfit = grossProfit - args.labor - fixed - variable;

  const cmRatio = grossSales > 0 ? grossProfit / grossSales : 0;
  const breakEvenSales = cmRatio > 0 ? (args.labor + fixed + variable) / cmRatio : 0;

  return {
    month,
    grossSales,
    vat,
    netSales,
    cogs,
    fees,
    packaging,
    grossProfit,
    labor: args.labor,
    fixed,
    variable,
    operatingProfit,
    orders: orderKeys.size,
    qty,
    byChannel: [...byChannel.values()].sort((a, b) => b.sales - a.sales),
    breakEvenSales,
    breakEvenDailySales: breakEvenSales / Math.max(1, args.openDays ?? daysInMonth(month)),
  };
}
