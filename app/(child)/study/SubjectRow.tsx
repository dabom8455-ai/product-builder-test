"use client";

import { useState, useTransition } from "react";
import { actSetSubject } from "@/app/actions";
import type { Subject } from "@/lib/queries";

const NEXT: Record<string, "todo" | "doing" | "done"> = {
  todo: "doing", doing: "done", done: "todo",
};
const LABEL: Record<string, string> = {
  todo: "아직", doing: "하는 중", done: "끝",
};
const STYLE: Record<string, string> = {
  todo: "bg-slate-100 text-slate-500",
  doing: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
};

export function SubjectRow({ subject }: { subject: Subject }) {
  const [status, setStatus] = useState(subject.status);
  const [, start] = useTransition();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{subject.subject}</p>
        <p className="mt-0.5 text-xs text-slate-500">{subject.unit}</p>
        {subject.owner && (
          <p className="mt-0.5 text-[11px] text-slate-400">{subject.owner}와 함께</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          const next = NEXT[status];
          setStatus(next);
          start(async () => { await actSetSubject(subject.id, next); });
        }}
        className={`tap shrink-0 rounded-xl px-3 text-xs font-bold ${STYLE[status]}`}
      >
        {LABEL[status]}
      </button>
    </div>
  );
}
