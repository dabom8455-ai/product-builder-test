"use client";

import type { ReactNode } from "react";

export function PageHeader({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-ink-2">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 md:p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-2">{sub}</div>}
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; size?: "sm" | "md" };
export function Button({ variant = "primary", size = "md", className = "", ...p }: BtnProps) {
  const v =
    variant === "primary"
      ? "bg-brand text-brand-ink hover:opacity-90"
      : variant === "danger"
        ? "border border-bad text-bad hover:bg-bad/10"
        : "border border-line hover:bg-surface-2";
  const s = size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm";
  return <button {...p} className={`rounded-lg font-medium disabled:opacity-40 ${v} ${s} ${className}`} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-2">{hint}</span>}
    </label>
  );
}

const INPUT_BASE = "min-w-0 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand";
/** 입력창 클래스. 너비(w-*)를 지정하지 않으면 w-full 을 쓴다 (Tailwind는 클래스 순서로 충돌을 풀지 않기 때문) */
export function ic(extra = "") {
  return `${INPUT_BASE} ${/(^|\s)w-/.test(extra) ? "" : "w-full "}${extra}`.trim();
}
export const inputCls = ic();

export function NumInput({ value, onChange, step, min, className = "", ...rest }: { value: number; onChange: (n: number) => void; step?: number; min?: number; className?: string; placeholder?: string; "aria-label"?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={ic(`tabular ${className}`)}
      value={Number.isFinite(value) ? value : ""}
      step={step}
      min={min}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      {...rest}
    />
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "good" | "bad" | "warn" | "brand" }) {
  const c =
    tone === "good"
      ? "bg-good/15 text-good"
      : tone === "bad"
        ? "bg-bad/15 text-bad"
        : tone === "warn"
          ? "bg-warn/15 text-warn"
          : tone === "brand"
            ? "bg-brand/15 text-brand"
            : "bg-surface-2 text-ink-2";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-sm ${value === o.id ? "bg-brand text-brand-ink font-semibold" : "text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-2">{children}</div>;
}

/** 계산식 펼쳐보기: 숫자 옆에 근거를 보여준다 (설계 원칙: 숫자는 항상 근거 표시) */
export function Explain({ children }: { children: ReactNode }) {
  return (
    <details className="mt-2 text-xs text-ink-2">
      <summary className="cursor-pointer select-none">계산 근거 보기</summary>
      <div className="mt-2 space-y-0.5">{children}</div>
    </details>
  );
}

export function Bar({ value, max, tone }: { value: number; max: number; tone?: "good" | "bad" | "brand" }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const c = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-brand";
  return (
    <div className="h-2 w-full rounded-full bg-surface-2">
      <div className={`h-2 rounded-full ${c}`} style={{ width: `${w}%` }} />
    </div>
  );
}
