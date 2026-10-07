"use client";

import { useActionState, useState } from "react";
import { doLogin, type LoginState } from "./actions";

type Profile = {
  slug: string; display_name: string; role: string; emoji: string; theme_color: string;
};

export function LoginForm({ profiles }: { profiles: Profile[] }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [state, action, pending] = useActionState<LoginState, FormData>(doLogin, {});

  const chosen = profiles.find((p) => p.slug === slug);

  if (!chosen) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {profiles.map((p) => (
          <button
            key={p.slug}
            type="button"
            onClick={() => setSlug(p.slug)}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white py-6 shadow-sm active:scale-95"
          >
            <span className="text-4xl" aria-hidden>{p.emoji}</span>
            <span className="text-lg font-bold">{p.display_name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="slug" value={chosen.slug} />
      <input type="hidden" name="pin" value={pin} />

      <div className="mb-4 flex items-center justify-center gap-2">
        <span className="text-3xl" aria-hidden>{chosen.emoji}</span>
        <span className="text-xl font-bold">{chosen.display_name}</span>
        <button
          type="button"
          onClick={() => { setSlug(null); setPin(""); }}
          className="ml-2 text-xs text-slate-400 underline"
        >
          바꾸기
        </button>
      </div>

      <div className="mb-5 flex justify-center gap-3" aria-label="비밀번호 입력 상태">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${pin.length > i ? "bg-blue-600" : "bg-slate-200"}`}
          />
        ))}
      </div>

      {state.error && (
        <p className="mb-4 text-center text-sm font-medium text-rose-600">{state.error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9","←","0","✓"].map((k) => (
          <button
            key={k}
            type={k === "✓" ? "submit" : "button"}
            disabled={pending || (k === "✓" && pin.length !== 4)}
            onClick={() => {
              if (k === "←") setPin((p) => p.slice(0, -1));
              else if (k !== "✓") setPin((p) => (p.length < 4 ? p + k : p));
            }}
            className={`tap-lg rounded-2xl text-2xl font-bold shadow-sm disabled:opacity-40 active:scale-95 ${
              k === "✓" ? "bg-blue-600 text-white" : "bg-white text-slate-700"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </form>
  );
}
