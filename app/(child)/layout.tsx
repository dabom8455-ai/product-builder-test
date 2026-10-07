import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { TabBar } from "@/components/TabBar";
import { displayDate, todayKST } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.role !== "child") redirect("/parent");

  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <span className="text-2xl" aria-hidden>{u.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight">{u.displayName}</p>
          <p className="text-xs text-slate-400">{displayDate(todayKST())}</p>
        </div>
        <Link href="/me" className="text-xs text-slate-400 underline">나의 변화</Link>
      </header>
      {children}
      <TabBar />
    </div>
  );
}
