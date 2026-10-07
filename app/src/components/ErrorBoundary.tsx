"use client";

import { Component, type ReactNode } from "react";

// 화면 하나에서 오류가 나도 앱 전체가 빈 화면이 되지 않게 막고, 무엇이 잘못됐는지 보여준다.
export class ErrorBoundary extends Component<{ children: ReactNode; onHome?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("화면 오류", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-bad/40 bg-bad/5 p-5">
        <h2 className="font-semibold text-bad">이 화면을 여는 중 오류가 났습니다</h2>
        <p className="mt-1 text-sm text-ink-2">다른 메뉴는 그대로 쓸 수 있고, 저장된 데이터는 안전합니다. 아래 오류 내용을 알려 주시면 고치겠습니다.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 text-xs">{String(this.state.error?.message ?? this.state.error)}</pre>
        <button
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink"
          onClick={() => {
            this.setState({ error: null });
            this.props.onHome?.();
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }
}
