"use client";

import type { ReplyInput } from "./domain/review";
import type { CaptionRequest, PosterCopy, PosterPurpose } from "./domain/poster";

// 실행 환경마다 다른 기능(AI 호출·파일 저장·인쇄)을 한 곳에 모은다.
// 웹(Next.js) 버전은 아래 기본값을, claude.ai 아티팩트 버전은 src/artifact/platform.ts 를 쓴다.

export interface CopyRequest {
  storeName: string;
  menuName: string;
  description?: string;
  price: number;
  purpose: PosterPurpose;
  praise: string[];
}

export interface Platform {
  /** AI 답글. 사용할 수 없으면 null (화면은 템플릿으로 대체) */
  reviewReply(input: ReplyInput): Promise<string | null>;
  posterCopies(req: CopyRequest): Promise<PosterCopy[] | null>;
  /** 인스타 게시글. 사용할 수 없으면 null */
  instaCaption(req: CaptionRequest): Promise<string | null>;
  /** 파일 저장. 사용자가 취소하거나 불가능하면 false */
  saveFile(filename: string, data: Blob): Promise<boolean>;
  canPrint: boolean;
  canShareFiles: boolean;
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const webPlatform: Platform = {
  async reviewReply(input) {
    return (await postJson<{ reply: string }>("/api/ai/reply", input))?.reply ?? null;
  },
  async posterCopies(req) {
    return (await postJson<{ copies: PosterCopy[] }>("/api/ai/copy", req))?.copies ?? null;
  },
  async instaCaption(req) {
    return (await postJson<{ caption: string }>("/api/ai/caption", req))?.caption ?? null;
  },
  async saveFile(filename, data) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  },
  canPrint: true,
  canShareFiles: true,
};

let current: Platform = webPlatform;

export function setPlatform(p: Platform) {
  current = p;
}

export function platform(): Platform {
  return current;
}

/** 화면 이동 시 함께 넘기는 값 (예: 포스터에 미리 선택할 메뉴). 웹은 쿼리스트링, 아티팩트는 메모리. */
const routeParams = new Map<string, string>();
export function setRouteParam(key: string, value: string) {
  routeParams.set(key, value);
}
export function takeRouteParam(key: string): string | null {
  const fromQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(key) : null;
  const v = fromQuery ?? routeParams.get(key) ?? null;
  routeParams.delete(key);
  return v;
}
