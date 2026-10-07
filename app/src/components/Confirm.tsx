"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { Button } from "./ui";

// 브라우저 confirm() 대신 쓰는 화면 안 확인창. (claude.ai 아티팩트에서는 confirm() 이 항상 false 를 돌려준다)

interface Pending {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ pending: Pending | null }>(() => ({ pending: null }));

export function askConfirm(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().pending?.resolve(false);
    useConfirmStore.setState({
      pending: { message, confirmLabel: opts.confirmLabel ?? "확인", danger: opts.danger ?? false, resolve },
    });
  });
}

export function ConfirmHost() {
  const pending = useConfirmStore((s) => s.pending);
  const close = (ok: boolean) => {
    pending?.resolve(ok);
    useConfirmStore.setState({ pending: null });
  };
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => close(false)}>
      <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{pending.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>
            취소
          </Button>
          <Button autoFocus variant={pending.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {pending.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
