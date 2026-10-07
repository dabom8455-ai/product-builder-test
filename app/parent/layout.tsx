import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { displayDate, todayKST } from "@/lib/date";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/parent", label: "경보" },
  { href: "/parent/tasks", label: "항목" },
  { href: "/parent/memo", label: "메모" },
];

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.role !== "parent") redirect("/");

  return (
    <div className="mx-auto max-w-md pb-12">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>{u.emoji}</span>
          <p className="flex-1 text-base font-bold">{u.displayName} — 부모 화면</p>
          <p className="text-xs text-slate-400">{displayDate(todayKST())}</p>
        </div>
        <nav className="mt-2 flex gap-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
