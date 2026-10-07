"use client";

import Link from "next/link";
import { WEEKDAY_LABELS, isoWeekday } from "@/lib/date";

export function DayPicker({ dates, current }: { dates: string[]; current: string }) {
  return (
    <div className="mt-3 flex gap-1.5">
      {dates.map((d) => {
        const active = d === current;
        return (
          <Link
            key={d}
            href={`/today?d=${d}`}
            className={`flex-1 rounded-xl py-1.5 text-center text-xs ${
              active ? "bg-blue-600 font-bold text-white" : "bg-white text-slate-400 shadow-sm"
            }`}
          >
            <span className="block">{WEEKDAY_LABELS[isoWeekday(d) - 1]}</span>
            <span className="block tabular-nums">{Number(d.slice(8, 10))}</span>
          </Link>
        );
      })}
    </div>
  );
}
