export function Section({
  title, note, children,
}: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="px-4 pb-2 text-sm font-bold text-slate-500">{title}</h2>
      {note && <p className="px-4 pb-2 text-xs leading-relaxed text-slate-400">{note}</p>}
      <div className="mx-4 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-slate-400">{children}</p>;
}
