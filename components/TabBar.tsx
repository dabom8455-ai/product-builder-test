"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "승리", emoji: "🏆" },
  { href: "/today", label: "오늘", emoji: "✅" },
  { href: "/exercise", label: "운동", emoji: "💪" },
  { href: "/study", label: "공부", emoji: "📚" },
  { href: "/record", label: "기록", emoji: "📖" },
  { href: "/me", label: "나", emoji: "📊" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`tap-lg flex flex-col items-center justify-center gap-0.5 text-[11px] ${
                  active ? "font-bold text-blue-600" : "text-slate-400"
                }`}
              >
                <span className="text-xl" aria-hidden>{t.emoji}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
