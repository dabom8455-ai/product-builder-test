"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useApp, demoData, emptyData } from "@/lib/store";
import { finishSetup, localAdapter, startPersistence, usePersistStatus } from "@/lib/persistence";
import { ConfirmHost } from "./Confirm";

const NAV = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/menu", label: "메뉴·원가", icon: "🧮" },
  { href: "/sales", label: "매출 입력", icon: "🧾" },
  { href: "/pnl", label: "손익", icon: "📊" },
  { href: "/analysis", label: "메뉴 분석", icon: "🔍" },
  { href: "/reviews", label: "리뷰 답글", icon: "💬" },
  { href: "/staff", label: "알바 근태", icon: "⏰" },
  { href: "/poster", label: "홍보 포스터", icon: "🖼️" },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

function SaveState() {
  const { label, saving, error } = usePersistStatus();
  const text = saving === "saving" ? "저장 중…" : saving === "error" ? "저장 실패" : saving === "saved" ? "저장됨" : "";
  return (
    <p className={`text-[11px] ${saving === "error" ? "text-bad" : "text-ink-2"}`} title={error ?? undefined}>
      {label && `저장 위치: ${label}`}
      {text && ` · ${text}`}
    </p>
  );
}

function Setup() {
  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="text-2xl font-bold">카페댐에 오신 걸 환영해요</h1>
      <p className="mt-2 text-sm text-ink-2">
        리뷰 답글, 원가 계산, 알바 근태, 홍보 포스터, 손익, 메뉴 분석을 한 곳에서 관리합니다. 어떻게 시작할까요?
      </p>
      <div className="mt-6 grid gap-3">
        <button className="rounded-2xl border border-line bg-surface p-5 text-left hover:border-brand" onClick={() => finishSetup(demoData())}>
          <div className="font-semibold">샘플 카페로 둘러보기</div>
          <div className="mt-1 text-sm text-ink-2">메뉴 12종, 8주 매출, 알바 3명, 리뷰 8건이 들어 있는 예시 카페입니다. 나중에 설정에서 지울 수 있어요.</div>
        </button>
        <button className="rounded-2xl border border-line bg-surface p-5 text-left hover:border-brand" onClick={() => finishSetup(emptyData())}>
          <div className="font-semibold">내 카페로 바로 시작</div>
          <div className="mt-1 text-sm text-ink-2">빈 상태에서 재료와 메뉴부터 등록합니다.</div>
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrated, needsSetup, error } = usePersistStatus();
  const storeName = useApp((s) => s.store.name);
  const brand = useApp((s) => s.store.brandColor);

  useEffect(() => {
    // 아티팩트 버전은 이미 자체 어댑터로 시작했으므로 여기서는 무시된다
    startPersistence(localAdapter(), { onEmpty: "demo" });
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const ready = hydrated && !needsSetup;

  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print hidden md:flex md:w-56 md:flex-col md:border-r md:border-line md:bg-surface md:sticky md:top-0 md:h-screen">
        <div className="px-5 py-5">
          <div className="text-xs text-ink-2">카페댐</div>
          <div className="flex items-center gap-2 font-bold text-lg">
            {ready && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: brand }} />}
            <span className="truncate">{ready ? storeName : " "}</span>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                isActive(n.href) ? "bg-brand text-brand-ink font-semibold" : "hover:bg-surface-2"
              }`}
            >
              <span aria-hidden>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4">
          <SaveState />
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="no-print md:hidden sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-line">
          <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
            <span className="flex min-w-0 items-center gap-2 font-bold">
              {ready && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: brand }} />}
              <span className="truncate">{ready ? storeName : " "}</span>
            </span>
            <SaveState />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  isActive(n.href) ? "bg-brand text-brand-ink font-semibold" : "bg-surface border border-line"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5 md:px-8 md:py-8">
          {error && <p className="mb-4 rounded-lg bg-bad/10 p-3 text-sm text-bad">{error}</p>}
          {!hydrated ? (
            <div className="py-20 text-center text-ink-2">불러오는 중…</div>
          ) : needsSetup ? (
            <Setup />
          ) : (
            children
          )}
        </main>
      </div>
      <ConfirmHost />
    </div>
  );
}
