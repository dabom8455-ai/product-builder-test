"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/store";
import type { Channel, Expense, SaleLine } from "@/lib/types";
import { CHANNELS } from "@/lib/types";
import { linePrice } from "@/lib/domain/pnl";
import { addDays, todayLocal } from "@/lib/dates";
import { Button, Card, Field, NumInput, PageHeader, Segmented, ic, inputCls } from "@/components/ui";
import { won } from "@/lib/format";

type Tab = "close" | "csv" | "expense";

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>("close");
  return (
    <div>
      <PageHeader
        title="매출 입력"
        desc="상류 데이터 ②: 판매 수량을 넣으면 원가·순이익·메뉴 분석이 자동 계산됩니다."
        right={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { id: "close", label: "일 마감" },
              { id: "csv", label: "엑셀/CSV" },
              { id: "expense", label: "지출" },
            ]}
          />
        }
      />
      {tab === "close" && <DailyClose />}
      {tab === "csv" && <CsvImport />}
      {tab === "expense" && <Expenses />}
    </div>
  );
}

function DailyClose() {
  const menus = useApp((s) => s.menus);
  const sales = useApp((s) => s.sales);
  const replaceSales = useApp((s) => s.replaceSales);
  const [date, setDate] = useState(todayLocal());
  const [channel, setChannel] = useState<Channel>("hall");
  const sellable = menus.filter((m) => !m.isSub && m.active);

  const existing = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of sales) if (l.date === date && l.channel === channel) map[l.menuId] = (map[l.menuId] ?? 0) + l.qty;
    return map;
  }, [sales, date, channel]);
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const values = draft ?? existing;
  const total = sellable.reduce((t, m) => t + linePrice(m, channel) * (values[m.id] ?? 0), 0);
  const dayTotal = useMemo(
    () =>
      sales
        .filter((l) => l.date === date)
        .reduce((t, l) => {
          const m = menus.find((x) => x.id === l.menuId);
          return t + (m ? linePrice(m, l.channel) * l.qty : 0);
        }, 0),
    [sales, date, menus],
  );
  const [saved, setSaved] = useState(false);

  const save = () => {
    replaceSales(
      date,
      channel,
      sellable.map((m) => ({ menuId: m.id, qty: values[m.id] ?? 0 })),
    );
    setDraft(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="날짜">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => (setDate(addDays(date, -1)), setDraft(null))}>
              ◀
            </Button>
            <input type="date" className={inputCls} value={date} onChange={(e) => (setDate(e.target.value), setDraft(null))} />
            <Button variant="ghost" size="sm" onClick={() => (setDate(addDays(date, 1)), setDraft(null))}>
              ▶
            </Button>
          </div>
        </Field>
        <Field label="채널">
          <Segmented value={channel} onChange={(c) => (setChannel(c), setDraft(null))} options={CHANNELS.map((c) => ({ id: c.id, label: c.label }))} />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sellable.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{m.name}</div>
              <div className="text-xs text-ink-2 tabular">{won(linePrice(m, channel))}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setDraft({ ...values, [m.id]: Math.max(0, (values[m.id] ?? 0) - 1) })}>
                −
              </Button>
              <NumInput className="w-16 text-center" value={values[m.id] ?? 0} min={0} onChange={(n) => setDraft({ ...values, [m.id]: Math.max(0, n) })} aria-label={`${m.name} 수량`} />
              <Button size="sm" variant="ghost" onClick={() => setDraft({ ...values, [m.id]: (values[m.id] ?? 0) + 1 })}>
                +
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          이 채널 합계 <b className="tabular">{won(total)}</b> · 이 날짜 전체 <span className="tabular">{won(dayTotal)}</span>
        </div>
        <Button onClick={save} disabled={!draft}>
          {saved ? "저장됨 ✓" : "마감 저장"}
        </Button>
      </div>
    </Card>
  );
}

function parseCsv(text: string, menuByName: Map<string, string>) {
  const rows: SaleLine[] = [];
  const errors: string[] = [];
  const chByLabel = new Map<string, Channel>(CHANNELS.flatMap((c) => [[c.id, c.id], [c.label, c.id]] as [string, Channel][]));
  chByLabel.set("홀", "hall");
  chByLabel.set("포장", "hall");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const cols = line.split(/[,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /날짜|date/i.test(cols[0])) return;
    const [date, ch, name, qtyStr] = cols;
    const channel = chByLabel.get(ch);
    const menuId = menuByName.get(name?.replace(/\s+/g, ""));
    const qty = Number(qtyStr);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return errors.push(`${i + 1}행: 날짜 형식(YYYY-MM-DD) 오류`);
    if (!channel) return errors.push(`${i + 1}행: 채널 "${ch}"을(를) 알 수 없음`);
    if (!menuId) return errors.push(`${i + 1}행: 메뉴 "${name}"이(가) 등록되어 있지 않음`);
    if (!Number.isFinite(qty) || qty < 0) return errors.push(`${i + 1}행: 수량 오류`);
    rows.push({ id: `sl-${date}-${menuId}-${channel}`, date, channel, menuId, qty });
  });
  // 같은 날짜·채널·메뉴가 여러 행이면 합산
  const merged = new Map<string, SaleLine>();
  for (const r of rows) {
    const prev = merged.get(r.id);
    merged.set(r.id, prev ? { ...prev, qty: prev.qty + r.qty } : r);
  }
  return { rows: [...merged.values()], errors };
}

function CsvImport() {
  const menus = useApp((s) => s.menus);
  const importSales = useApp((s) => s.importSales);
  const [text, setText] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const menuByName = useMemo(() => new Map(menus.filter((m) => !m.isSub).map((m) => [m.name.replace(/\s+/g, ""), m.id])), [menus]);
  const { rows, errors } = useMemo(() => parseCsv(text, menuByName), [text, menuByName]);

  const onFile = async (f: File) => setText(await f.text());

  return (
    <Card title="POS·배달앱 판매 내역 가져오기">
      <p className="text-sm text-ink-2">
        POS나 배달앱에서 내려받은 메뉴별 판매 내역을 아래 형식(CSV)으로 맞춰 붙여넣거나 파일을 올리세요. 같은 날짜·채널의 기존 기록은 덮어씁니다.
      </p>
      <pre className="mt-2 rounded-lg bg-surface-2 p-3 text-xs">{`날짜,채널,메뉴,수량\n2026-10-05,홀,아이스 아메리카노,31\n2026-10-05,배민,바닐라라떼,4`}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <input type="file" accept=".csv,.txt,.tsv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" />
      </div>
      <textarea className={ic("mt-3 h-40 font-mono text-xs")} value={text} onChange={(e) => (setText(e.target.value), setDone(null))} placeholder="여기에 붙여넣기" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          인식된 행 <b>{rows.length}</b> {errors.length > 0 && <span className="text-bad">· 오류 {errors.length}</span>}
        </span>
        <Button
          disabled={rows.length === 0}
          onClick={() => {
            importSales(rows);
            setDone(`${rows.length}행을 가져왔습니다.`);
            setText("");
          }}
        >
          가져오기
        </Button>
      </div>
      {done && <p className="mt-2 text-sm text-good">{done}</p>}
      {errors.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-auto text-xs text-bad">
          {errors.slice(0, 50).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Expenses() {
  const expenses = useApp((s) => s.expenses);
  const recurring = useApp((s) => s.recurring);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const list = expenses.filter((e) => e.month === month);

  const add = (category: Expense["category"]) => upsert("expenses", { id: newId("x"), month, category, name: category === "fixed" ? "기타 고정비" : "기타 변동비", amount: 0 });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="매월 고정비 (자동 반영)" right={<Button size="sm" onClick={() => upsert("recurring", { id: newId("r"), name: "새 고정비", amount: 0 })}>+ 추가</Button>}>
        <p className="mb-2 text-xs text-ink-2">임대료처럼 매달 같은 금액은 여기에 한 번만 등록하세요.</p>
        <ul className="space-y-2">
          {recurring.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <input className={ic("flex-1")} value={r.name} onChange={(e) => upsert("recurring", { ...r, name: e.target.value })} />
              <NumInput className="w-32 text-right" value={r.amount} step={10000} onChange={(n) => upsert("recurring", { ...r, amount: n })} />
              <button className="text-ink-2 hover:text-bad" aria-label="삭제" onClick={() => remove("recurring", r.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right text-sm">
          합계 <b className="tabular">{won(recurring.reduce((t, r) => t + r.amount, 0))}</b>
        </p>
      </Card>
      <Card
        title="월별 지출"
        right={<input type="month" className={ic("w-40")} value={month} onChange={(e) => setMonth(e.target.value)} />}
      >
        <ul className="space-y-2">
          {list.map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <select className={ic("w-24")} value={x.category} onChange={(e) => upsert("expenses", { ...x, category: e.target.value as Expense["category"] })}>
                <option value="variable">변동</option>
                <option value="fixed">고정</option>
              </select>
              <input className={ic("flex-1")} value={x.name} onChange={(e) => upsert("expenses", { ...x, name: e.target.value })} />
              <NumInput className="w-28 text-right" value={x.amount} step={10000} onChange={(n) => upsert("expenses", { ...x, amount: n })} />
              <button className="text-ink-2 hover:text-bad" aria-label="삭제" onClick={() => remove("expenses", x.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => add("variable")}>
              + 변동비
            </Button>
            <Button size="sm" variant="ghost" onClick={() => add("fixed")}>
              + 고정비
            </Button>
          </div>
          <span className="text-sm">
            합계 <b className="tabular">{won(list.reduce((t, x) => t + x.amount, 0))}</b>
          </span>
        </div>
      </Card>
    </div>
  );
}
