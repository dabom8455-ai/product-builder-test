"use client";

import { create } from "zustand";
import { completeData, demoData, pickData, useApp, type AppData } from "./store";

// 저장 엔진: 어댑터에서 한 번 불러오고, 이후 상태가 바뀔 때마다 잠깐 모았다가 어댑터로 저장한다.
// 어댑터만 바꾸면 브라우저 저장소 ↔ claude.ai db ↔ (나중에) 자체 서버로 옮길 수 있다.

export interface PersistAdapter {
  /** 화면에 보여줄 저장 위치 이름 */
  label: string;
  /** 저장된 데이터. 아무것도 없으면 null */
  load(): Promise<Partial<AppData> | null>;
  /** prev 는 마지막으로 저장에 성공한 상태(처음이면 null). 바뀐 부분만 쓰는 데 쓴다. */
  save(next: AppData, prev: AppData | null): Promise<void>;
}

interface PersistStatus {
  hydrated: boolean;
  /** 저장소가 비어 있어 시작 방법(샘플/빈 상태)을 골라야 함 */
  needsSetup: boolean;
  saving: "idle" | "saving" | "saved" | "error";
  error: string | null;
  label: string;
}

export const usePersistStatus = create<PersistStatus>(() => ({
  hydrated: false,
  needsSetup: false,
  saving: "idle",
  error: null,
  label: "",
}));

export const useHydrated = () => usePersistStatus((s) => s.hydrated);

let adapter: PersistAdapter | null = null;
let lastSaved: AppData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let dirty = false;
let started = false;

async function flush() {
  if (!adapter || usePersistStatus.getState().needsSetup) return;
  if (inFlight) {
    dirty = true;
    return;
  }
  inFlight = true;
  dirty = false;
  const next = pickData(useApp.getState());
  usePersistStatus.setState({ saving: "saving" });
  try {
    await adapter.save(next, lastSaved);
    lastSaved = next;
    usePersistStatus.setState({ saving: "saved", error: null });
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e);
    usePersistStatus.setState({ saving: "error", error: msg });
  } finally {
    inFlight = false;
    if (dirty) schedule();
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 700);
}

export async function startPersistence(a: PersistAdapter, opts: { onEmpty: "demo" | "ask" }) {
  if (started) return;
  started = true;
  adapter = a;
  usePersistStatus.setState({ label: a.label });
  let loaded: Partial<AppData> | null = null;
  try {
    loaded = await a.load();
  } catch (e) {
    usePersistStatus.setState({ error: `불러오기 실패: ${(e as { message?: string })?.message ?? e}` });
  }
  usePersistStatus.setState({ label: a.label }); // 어댑터가 불러오는 중에 실제 저장 위치를 정할 수 있다
  if (loaded) {
    useApp.setState(completeData(loaded));
    lastSaved = pickData(useApp.getState());
  } else if (opts.onEmpty === "demo") {
    useApp.setState(demoData());
    schedule();
  } else {
    usePersistStatus.setState({ needsSetup: true });
  }
  useApp.subscribe(() => schedule());
  usePersistStatus.setState({ hydrated: true });
}

/** 첫 실행에서 시작 데이터를 고른 뒤 호출 */
export function finishSetup(data: AppData) {
  usePersistStatus.setState({ needsSetup: false });
  useApp.setState(data);
  schedule();
}

/** 브라우저 localStorage 어댑터. 읽기/쓰기가 막힌 환경(사생활 보호 창 등)에서는 오류를 던진다. */
export function localAdapter(key = "cafedam-v1"): PersistAdapter {
  return {
    label: "이 기기 브라우저",
    async load() {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // 이전 버전(zustand persist)은 { state, version } 형태로 저장했다
      return (parsed?.state ?? parsed) as Partial<AppData>;
    },
    async save(next) {
      localStorage.setItem(key, JSON.stringify({ state: next, version: 2 }));
    },
  };
}
