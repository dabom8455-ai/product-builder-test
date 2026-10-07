"use client";

import { useState, useTransition } from "react";
import { actToggle, actSetNum, actSetText } from "@/app/actions";

export type TaskView = {
  task_key: string;
  label: string;
  emoji: string;
  value_type: "bool" | "num" | "text" | "time" | "mood";
  target_num: number | null;
  unit: string | null;
  choice_group: string | null;
  hint: string | null;
};

type Common = {
  task: TaskView;
  value: { bool: boolean | null; num: number | null; text: string | null } | undefined;
  date?: string;
  childId?: number;
  size?: "md" | "lg";
};

const MOODS = ["😀", "🙂", "😐", "😢", "😡"];

function Row({
  task, size, right, children,
}: { task: TaskView; size?: "md" | "lg"; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 px-4 ${size === "lg" ? "py-4" : "py-3"}`}>
      <span className={size === "lg" ? "text-3xl" : "text-2xl"} aria-hidden>
        {task.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${size === "lg" ? "text-lg" : "text-[15px]"}`}>{task.label}</p>
        {task.hint && <p className="mt-0.5 text-xs leading-snug text-slate-400">{task.hint}</p>}
        {children}
      </div>
      {right}
    </div>
  );
}

export function BoolTask({ task, value, date, childId, size }: Common) {
  const [on, setOn] = useState(value?.bool === true);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    start(async () => {
      await actToggle(task.task_key, next, task.choice_group, date, childId);
    });
  }

  return (
    <Row
      task={task}
      size={size}
      right={
        <button
          type="button"
          onClick={toggle}
          aria-pressed={on}
          aria-label={task.label}
          className={`${size === "lg" ? "tap-lg w-16" : "tap w-14"} grid place-items-center rounded-xl border-2 text-2xl transition-colors ${
            on
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-200 bg-slate-50 text-slate-300"
          } ${pending ? "opacity-60" : ""}`}
        >
          {on ? "✓" : ""}
        </button>
      }
    />
  );
}

export function NumTask({ task, value, date, childId, size }: Common) {
  const step = task.unit === "분" ? 10 : 1;
  const [n, setN] = useState<number | null>(value?.num ?? null);
  const [, start] = useTransition();

  function change(next: number | null) {
    setN(next);
    start(async () => {
      await actSetNum(task.task_key, next, date, childId);
    });
  }

  const over = task.target_num !== null && n !== null && n > task.target_num;
  const met = task.target_num !== null && n !== null && n >= task.target_num;
  // 간식·스크린은 적을수록 좋고, 물은 많을수록 좋다
  const lowerIsBetter = task.task_key === "snack_count" || task.task_key === "screen_min";

  return (
    <Row
      task={task}
      size={size}
      right={
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`${task.label} 줄이기`}
            onClick={() => change(Math.max(0, (n ?? 0) - step))}
            className="tap w-11 rounded-xl border-2 border-slate-200 bg-slate-50 text-xl text-slate-500"
          >
            −
          </button>
          <span
            className={`w-14 text-center text-xl font-bold tabular-nums ${
              n === null
                ? "text-slate-300"
                : lowerIsBetter
                  ? over ? "text-rose-500" : "text-emerald-600"
                  : met ? "text-emerald-600" : "text-slate-700"
            }`}
          >
            {n === null ? "–" : n}
          </span>
          <button
            type="button"
            aria-label={`${task.label} 늘리기`}
            onClick={() => change((n ?? 0) + step)}
            className="tap w-11 rounded-xl border-2 border-slate-200 bg-slate-50 text-xl text-slate-500"
          >
            +
          </button>
        </div>
      }
    >
      {task.target_num !== null && (
        <p className="mt-0.5 text-xs text-slate-400">
          {lowerIsBetter ? "하루 " : "목표 "}
          {task.target_num}
          {task.unit}
          {lowerIsBetter ? "까지" : ""}
        </p>
      )}
    </Row>
  );
}

export function TimeTask({ task, value, date, childId, size }: Common) {
  const [t, setT] = useState(value?.text ?? "");
  const [, start] = useTransition();

  return (
    <Row
      task={task}
      size={size}
      right={
        <input
          type="time"
          value={t}
          onChange={(e) => {
            setT(e.target.value);
            start(async () => {
              await actSetText(task.task_key, e.target.value, date, childId);
            });
          }}
          className="tap rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base tabular-nums"
        />
      }
    />
  );
}

export function MoodTask({ task, value, date, childId, size }: Common) {
  const [m, setM] = useState(value?.text ?? "");
  const [, start] = useTransition();

  return (
    <Row task={task} size={size}>
      <div className="mt-2 flex gap-2">
        {MOODS.map((e) => (
          <button
            key={e}
            type="button"
            aria-label={`기분 ${e}`}
            aria-pressed={m === e}
            onClick={() => {
              const next = m === e ? "" : e;
              setM(next);
              start(async () => {
                await actSetText(task.task_key, next, date, childId);
              });
            }}
            className={`tap-lg flex-1 rounded-xl border-2 text-3xl transition-colors ${
              m === e ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </Row>
  );
}

export function TextTask({ task, value, date, childId, size }: Common) {
  const [v, setV] = useState(value?.text ?? "");
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  return (
    <Row task={task} size={size}>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={v}
          onChange={(e) => { setV(e.target.value); setSaved(false); }}
          onBlur={() => {
            start(async () => {
              await actSetText(task.task_key, v, date, childId);
              setSaved(true);
            });
          }}
          placeholder="한 줄만 적어도 돼"
          className="tap min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-base"
        />
        {saved && <span className="self-center text-xs text-emerald-600">저장됨</span>}
      </div>
    </Row>
  );
}

export function TaskItem(props: Common) {
  switch (props.task.value_type) {
    case "num": return <NumTask {...props} />;
    case "time": return <TimeTask {...props} />;
    case "mood": return <MoodTask {...props} />;
    case "text": return <TextTask {...props} />;
    default: return <BoolTask {...props} />;
  }
}
