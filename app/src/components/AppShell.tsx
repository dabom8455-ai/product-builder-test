"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useApp, useHydrated } from "@/lib/store";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const storeName = useApp((s) => s.store.name);
  const brand = useApp((s) => s.store.brandColor);

  useEffect(() => {
    useApp.persist.rehydrate();
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print hidden md:flex md:w-56 md:flex-col md:border-r md:border-line md:bg-surface md:sticky md:top-0 md:h-screen">
        <div className="px-5 py-5">
          <div className="text-xs text-ink-2">카페댐</div>
          <div className="font-bold text-lg truncate" style={{ color: hydrated ? brand : undefined }}>
            {hydrated ? storeName : " "}
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
        <p className="px-5 py-4 text-[11px] text-ink-2">데이터는 이 기기 브라우저에 저장됩니다.</p>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="no-print md:hidden sticky top-0 z-20 bg-bg/95 backdrop-blur border-b border-line">
          <div className="px-4 pt-3 font-bold" style={{ color: hydrated ? brand : undefined }}>
            {hydrated ? storeName : " "}
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
          {hydrated ? children : <div className="py-20 text-center text-ink-2">불러오는 중…</div>}
        </main>
      </div>
    </div>
  );
}
