"use client";

import { useState, useTransition } from "react";
import { actUsePassCard } from "@/app/actions";

export function PassCardButton({ used }: { used: string | null }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  if (used) {
    return (
      <div className="rounded-2xl bg-white px-4 py-3 text-center text-sm text-slate-500 shadow-sm">
        🃏 이번 달 포기권은 {used} 에 썼어
      </div>
    );
  }

  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="tap-lg w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 text-sm font-medium text-amber-800"
      >
        🃏 오늘은 너무 힘들어 — 포기권 쓰기 (한 달에 한 번)
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-amber-50 p-4 text-center">
      <p className="text-sm leading-relaxed text-amber-900">
        포기권을 쓰면 오늘은 쉬는 날이야.<br />
        연속 기록은 <b>끊기지 않아.</b> 이번 달에 한 번만 쓸 수 있어.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="tap flex-1 rounded-xl bg-white text-sm font-medium text-slate-500"
        >
          아니야
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await actUsePassCard(); })}
          className="tap flex-1 rounded-xl bg-amber-500 text-sm font-bold text-white disabled:opacity-50"
        >
          쓸게
        </button>
      </div>
    </div>
  );
}
