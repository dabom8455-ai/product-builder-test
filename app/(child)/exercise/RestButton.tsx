"use client";

import { useTransition } from "react";
import { actRestExercise } from "@/app/actions";

export function RestButton({ rested }: { rested: boolean }) {
  const [pending, start] = useTransition();

  if (rested) {
    return (
      <p className="rounded-2xl bg-white px-4 py-3 text-center text-sm text-slate-500 shadow-sm">
        오늘은 쉬는 날로 적었어. 괜찮아.
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await actRestExercise(); })}
      className="tap w-full rounded-2xl bg-white text-sm font-medium text-slate-500 shadow-sm disabled:opacity-50"
    >
      오늘은 쉴게
    </button>
  );
}
