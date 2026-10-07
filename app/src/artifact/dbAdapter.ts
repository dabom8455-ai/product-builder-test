// claude.ai 아티팩트 db 어댑터. 문서 하나가 256KB 를 넘지 않도록 판매·근태는 월별 문서로 나눠 저장한다.
//   cafe/<키>             { value }            매장·메뉴·재료·직원·리뷰 등
//   sales/<YYYY-MM>       { lines: [[날짜, 채널, 메뉴id, 수량], ...] }
//   attendance/<YYYY-MM>  { rows: Attendance[] }
import type { PersistAdapter } from "@/lib/persistence";
import { localAdapter } from "@/lib/persistence";
import { APP_KEYS, type AppData } from "@/lib/store";
import type { Attendance, Channel, SaleLine } from "@/lib/types";

const SHARDED = new Set<keyof AppData>(["sales", "attendance"]);
const SIMPLE_KEYS = APP_KEYS.filter((k) => !SHARDED.has(k));

type SaleTuple = [string, Channel, string, number];

function byMonth<T>(items: T[], monthOf: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = monthOf(it);
    const list = m.get(k) ?? [];
    list.push(it);
    m.set(k, list);
  }
  return m;
}

const saleMonths = (sales: SaleLine[]) =>
  new Map([...byMonth(sales, (l) => l.date.slice(0, 7))].map(([k, v]) => [k, JSON.stringify(v.map((l) => [l.date, l.channel, l.menuId, l.qty]))]));
const attendanceMonths = (rows: Attendance[]) => new Map([...byMonth(rows, (a) => a.clockIn.slice(0, 7))].map(([k, v]) => [k, JSON.stringify(v)]));

function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code === "quota_exceeded") return new Error("저장 공간이 가득 찼습니다. 오래된 판매·근무 기록을 백업한 뒤 지워 주세요.");
  if (code === "invalid_argument") return new Error("이 화면에서는 저장 권한이 없습니다(보기 전용). 변경 내용이 저장되지 않습니다.");
  if (code === "resource_exhausted") return new Error("저장 요청이 너무 많습니다. 잠시 후 자동으로 다시 저장합니다.");
  return new Error((e as { message?: string })?.message ?? "저장 중 오류가 발생했습니다.");
}

/** 쓰기 한 번: 일시 오류(unavailable)는 잠깐 쉬고 한 번만 다시 시도 */
async function write(op: () => Promise<void>) {
  try {
    await op();
  } catch (e) {
    if ((e as { code?: string })?.code !== "unavailable") throw friendly(e);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
    try {
      await op();
    } catch (e2) {
      throw friendly(e2);
    }
  }
}

function dbAdapter(db: ArtifactDB): PersistAdapter {
  return {
    label: "claude.ai (모든 기기에서 같은 데이터)",
    async load() {
      const [cafe, sales, attendance] = await Promise.all([db.collection("cafe").get(), db.collection("sales").get(), db.collection("attendance").get()]);
      if (cafe.empty && sales.empty && attendance.empty) return null;
      const out: Partial<AppData> = {};
      for (const d of cafe.docs) {
        if ((SIMPLE_KEYS as string[]).includes(d.id)) (out as Record<string, unknown>)[d.id] = d.data()?.value;
      }
      out.sales = sales.docs.flatMap((d) =>
        ((d.data()?.lines as SaleTuple[]) ?? []).map(([date, channel, menuId, qty]) => ({ id: `sl-${date}-${menuId}-${channel}`, date, channel, menuId, qty })),
      );
      out.attendance = attendance.docs.flatMap((d) => (d.data()?.rows as Attendance[]) ?? []);
      return out;
    },
    async save(next, prev) {
      for (const k of SIMPLE_KEYS) {
        if (prev && prev[k] === next[k]) continue;
        if (prev && JSON.stringify(prev[k]) === JSON.stringify(next[k])) continue;
        await write(() => db.doc(`cafe/${k}`).set({ value: next[k] as unknown as Record<string, unknown> }));
      }
      if (!prev || prev.sales !== next.sales) {
        const a = prev ? saleMonths(prev.sales) : new Map<string, string>();
        const b = saleMonths(next.sales);
        for (const [m, json] of b) if (a.get(m) !== json) await write(() => db.doc(`sales/${m}`).set({ lines: JSON.parse(json) }));
        for (const m of a.keys()) if (!b.has(m)) await write(() => db.doc(`sales/${m}`).delete());
      }
      if (!prev || prev.attendance !== next.attendance) {
        const a = prev ? attendanceMonths(prev.attendance) : new Map<string, string>();
        const b = attendanceMonths(next.attendance);
        for (const [m, json] of b) if (a.get(m) !== json) await write(() => db.doc(`attendance/${m}`).set({ rows: JSON.parse(json) }));
        for (const m of a.keys()) if (!b.has(m)) await write(() => db.doc(`attendance/${m}`).delete());
      }
    },
  };
}

function memoryAdapter(): PersistAdapter {
  return { label: "저장 안 됨 (미리보기)", load: async () => null, save: async () => {} };
}

/** db 를 쓸 수 있으면 db, 아니면 이 브라우저 저장소, 그것도 막혀 있으면 메모리. load 시점에 결정한다. */
export function artifactAdapter(): PersistAdapter {
  let inner: PersistAdapter | null = null;
  const self: PersistAdapter = {
    label: "확인 중…",
    async load() {
      const db = (await window.claude?.use("db").catch(() => null)) ?? null;
      if (db) inner = dbAdapter(db);
      else {
        try {
          localStorage.setItem("cafedam-probe", "1");
          localStorage.removeItem("cafedam-probe");
          inner = { ...localAdapter("cafedam-artifact"), label: "이 브라우저만 (로그인하면 claude.ai에 저장)" };
        } catch {
          inner = memoryAdapter();
        }
      }
      self.label = inner.label;
      return inner.load();
    },
    save: (next, prev) => (inner ? inner.save(next, prev) : Promise.resolve()),
  };
  return self;
}
