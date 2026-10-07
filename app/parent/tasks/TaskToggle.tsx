"use client";

import { useState, useTransition } from "react";
import { actToggleTask } from "@/app/actions";

export function TaskToggle({ id, active }: { id: number; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => { await actToggleTask(id, next); });
      }}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        on ? "bg-emerald-500" : "bg-slate-300"
      } ${pending ? "opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
