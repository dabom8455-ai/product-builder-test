"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/store";
import type { Channel, DayNote, Expense, SaleLine, Weather } from "@/lib/types";
import { CHANNELS, WEATHER } from "@/lib/types";
import { linePrice } from "@/lib/domain/pnl";
import { addDays, addMonths, daysInMonth, dayOfWeek, DOW_LABEL, todayLocal } from "@/lib/dates";
import { Button, Card, Field, NumInput, PageHeader, Segmented, ic, inputCls } from "@/components/ui";
import { man, won } from "@/lib/format";

type Tab = "close" | "calendar" | "csv" | "expense";

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>("close");
  const [date, setDate] = useState(todayLocal());
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
              { id: "calendar", label: "달력" },
              { id: "csv", label: "엑셀/CSV" },
              { id: "expense", label: "지출" },
            ]}
          />
        }
      />
      {tab === "close" && <DailyClose date={date} setDate={setDate} />}
      {tab === "calendar" && <SalesCalendar onPick={(d) => (setDate(d), setTab("close"))} />}
      {tab === "csv" && <CsvImport />}
      {tab === "expense" && <Expenses />}
    </div>
  );
}

function DailyClose({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const menus = useApp((s) => s.menus);
  const sales = useApp((s) => s.sales);
  const replaceSales = useApp((s) => s.replaceSales);
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
  const store = useApp((s) => s.store);
  const lastWeek = addDays(date, -7);
  const lastWeekValues = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of sales) if (l.date === lastWeek && l.channel === channel) map[l.menuId] = (map[l.menuId] ?? 0) + l.qty;
    return map;
  }, [sales, lastWeek, channel]);
  const hasLastWeek = Object.keys(lastWeekValues).length > 0;
  const closed = store.closedDays.includes(dayOfWeek(date));

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
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink-2">
          {DOW_LABEL[dayOfWeek(date)]}요일{closed && " · 정기 휴무일"}
        </span>
        <Button
          size="sm"
          variant="ghost"
          disabled={!hasLastWeek}
          title={hasLastWeek ? undefined : "지난주 같은 요일·채널 기록이 없습니다"}
          onClick={() => setDraft({ ...lastWeekValues })}
        >
          지난주 {DOW_LABEL[dayOfWeek(date)]}요일({lastWeek.slice(5)}) 수량 불러오기
        </Button>
      </div>
      <DayNoteEditor key={date} date={date} />
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

/** 날씨·메모: 매출의 맥락을 남긴다 */
function DayNoteEditor({ date }: { date: string }) {
  const note = useApp((s) => s.dayNotes.find((n) => n.date === date));
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const [memo, setMemo] = useState(note?.memo ?? "");
  const save = (patch: Partial<DayNote>) => {
    const next: DayNote = { id: date, date, weather: note?.weather, memo: note?.memo, ...patch };
    if (!next.weather && !next.memo?.trim()) remove("dayNotes", date);
    else upsert("dayNotes", next);
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2.5">
      <span className="text-xs text-ink-2">날씨</span>
      {(Object.keys(WEATHER) as Weather[]).map((w) => (
        <button
          key={w}
          type="button"
          aria-pressed={note?.weather === w}
          onClick={() => save({ weather: note?.weather === w ? undefined : w })}
          className={`rounded-full border px-2 py-0.5 text-xs ${note?.weather === w ? "border-brand bg-brand/10 font-semibold" : "border-line bg-surface"}`}
        >
          {WEATHER[w]}
        </button>
      ))}
      <input
        className={ic("min-w-40 flex-1 py-1")}
        placeholder="메모 (행사, 공사, 단체 주문 등)"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() => memo !== (note?.memo ?? "") && save({ memo: memo.trim() || undefined })}
        aria-label="날짜 메모"
      />
    </div>
  );
}

/** 월 달력: 일매출·미입력·휴무·날씨를 한눈에. 날짜를 누르면 그날 마감 입력으로 이동 */
function SalesCalendar({ onPick }: { onPick: (date: string) => void }) {
  const sales = useApp((s) => s.sales);
  const menus = useApp((s) => s.menus);
  const notes = useApp((s) => s.dayNotes);
  const closedDays = useApp((s) => s.store.closedDays);
  const target = useApp((s) => s.store.monthlySalesTarget);
  const today = todayLocal();
  const [month, setMonth] = useState(today.slice(0, 7));

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    const menuById = new Map(menus.map((m) => [m.id, m]));
    for (const l of sales) {
      if (!l.date.startsWith(month)) continue;
      const m = menuById.get(l.menuId);
      if (m) map.set(l.date, (map.get(l.date) ?? 0) + linePrice(m, l.channel) * l.qty);
    }
    return map;
  }, [sales, menus, month]);

  const n = daysInMonth(month);
  const first = dayOfWeek(`${month}-01`);
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const max = Math.max(1, ...totals.values());
  const sum = [...totals.values()].reduce((t, v) => t + v, 0);
  const missing = cells.filter((d): d is string => !!d && d < today && !totals.has(d) && !closedDays.includes(dayOfWeek(d)));
  const openDays = cells.filter((d): d is string => !!d && !closedDays.includes(dayOfWeek(d))).length;
  const dailyTarget = target > 0 ? target / Math.max(1, openDays) : 0;

  return (
    <Card
      title={
        <span className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="이전 달">
            ◀
          </Button>
          <span className="w-24 text-center tabular">{month}</span>
          <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="다음 달">
            ▶
          </Button>
        </span>
      }
      right={
        <span className="text-sm">
          합계 <b className="tabular">{man(sum)}원</b>
          {missing.length > 0 && <span className="ml-2 text-bad">미입력 {missing.length}일</span>}
        </span>
      }
    >
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-2">
        {DOW_LABEL.map((d, i) => (
          <div key={d} className={i === 0 ? "text-bad" : ""}>
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const v = totals.get(d);
          const closed = closedDays.includes(dayOfWeek(d));
          const isMissing = missing.includes(d);
          const note = notes.find((x) => x.date === d);
          const hit = dailyTarget > 0 && v !== undefined && v >= dailyTarget;
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              title={note?.memo}
              className={`relative flex min-h-16 flex-col items-start rounded-lg border p-1.5 text-left ${
                d === today ? "border-brand" : isMissing ? "border-bad/60 bg-bad/5" : "border-line"
              } ${closed ? "bg-surface-2" : ""}`}
            >
              <span className={`text-[11px] ${dayOfWeek(d) === 0 ? "text-bad" : "text-ink-2"}`}>
                {Number(d.slice(8))} {note?.weather && WEATHER[note.weather].split(" ")[0]}
              </span>
              {v !== undefined ? (
                <>
                  <span className={`mt-auto text-[11px] font-semibold tabular sm:text-xs ${hit ? "text-good" : ""}`}>{man(v)}</span>
                  <span className="mt-0.5 h-1 w-full rounded-full bg-surface-2">
                    <span className="block h-1 rounded-full bg-brand" style={{ width: `${(v / max) * 100}%` }} />
                  </span>
                </>
              ) : (
                <span className="mt-auto text-[10px] text-ink-2">{closed ? "휴무" : isMissing ? "미입력" : ""}</span>
              )}
              {note?.memo && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warn" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-ink-2">
        빨간 칸은 영업일인데 매출이 없는 날, 노란 점은 메모가 있는 날입니다{dailyTarget > 0 && `. 초록 숫자는 일 목표(${man(dailyTarget)}원) 달성`}. 날짜를 누르면 그날 마감을 입력·수정합니다.
      </p>
    </Card>
  );
}
