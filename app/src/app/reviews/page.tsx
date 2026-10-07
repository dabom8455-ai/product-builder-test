"use client";

import { useMemo, useRef, useState } from "react";
import { newId, useApp } from "@/lib/store";
import type { Review, ReviewPlatform } from "@/lib/types";
import { analyzeReview, parseBulkReviews, templateReply, withSignature, type ReplyInput } from "@/lib/domain/review";
import { addMonths, todayLocal } from "@/lib/dates";
import { Badge, Button, Card, Empty, Field, PageHeader, Segmented, ic, inputCls } from "@/components/ui";
import { platform } from "@/lib/platform";
import { askConfirm } from "@/components/Confirm";

const PLATFORM: Record<ReviewPlatform, string> = { naver: "네이버", baemin: "배민", coupang: "쿠팡이츠", etc: "기타" };
const SENT = { positive: { label: "긍정", tone: "good" }, neutral: { label: "중립", tone: "warn" }, negative: { label: "부정", tone: "bad" } } as const;

/** 리뷰 1건의 답글 초안: AI 를 먼저 시도하고, 안 되면 템플릿 */
async function draftReply(review: Review): Promise<Review> {
  const { store, menus, reviews } = useApp.getState();
  const analysis = analyzeReview(review.text, review.rating, menus);
  const input: ReplyInput = {
    storeName: store.name,
    tone: store.tone,
    text: review.text,
    rating: review.rating,
    author: review.author,
    analysis,
    menuNames: review.menuIds.map((id) => menus.find((m) => m.id === id)?.name).filter((x): x is string => !!x),
    recentReplies: reviews.filter((r) => r.reply && r.id !== review.id).map((r) => r.reply!).slice(-5),
    signature: store.replySignature,
  };
  const ai = await platform().reviewReply(input);
  return { ...review, reply: ai ? withSignature(ai, store.replySignature) : templateReply(input), replySource: ai ? "ai" : "template", status: "drafted" };
}

function makeReview(text: string, rating: number, platform: ReviewPlatform, author?: string): Review {
  const a = analyzeReview(text, rating, useApp.getState().menus);
  return {
    id: newId("rv"),
    platform,
    rating,
    author: author || undefined,
    text,
    createdAt: todayLocal(),
    sentiment: a.sentiment,
    menuIds: a.menuIds,
    keywords: [...a.keywords, ...a.issues],
    status: "pending",
  };
}

export default function ReviewsPage() {
  const reviews = useApp((s) => s.reviews);
  const [filter, setFilter] = useState<"todo" | "posted" | "all">("todo");
  const list = reviews
    .filter((r) => (filter === "all" ? true : filter === "todo" ? r.status !== "posted" : r.status === "posted"))
    .sort((a, b) => (a.sentiment === "negative" ? -1 : 0) - (b.sentiment === "negative" ? -1 : 0) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-5">
      <PageHeader
        title="리뷰 답글"
        desc="리뷰를 붙여넣으면 메뉴·감정·불만 키워드를 분석하고 가게 말투로 답글 초안을 만듭니다. 부정 리뷰는 반드시 직접 확인 후 게시하세요."
      />
      <p className="rounded-lg bg-surface-2 p-3 text-xs text-ink-2">
        네이버 스마트플레이스·배민 사장님광장은 답글 작성용 공식 공개 API가 없어 지금은 <b>붙여넣기 → 초안 생성 → 복사해서 게시</b> 방식으로 동작합니다.
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <AddReview />
          <KeywordReport />
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { id: "todo", label: `답글 대기 ${reviews.filter((r) => r.status !== "posted").length}` },
                { id: "posted", label: "게시 완료" },
                { id: "all", label: "전체" },
              ]}
            />
            <BulkDraft />
          </div>
          {list.length === 0 ? <Empty>리뷰가 없습니다.</Empty> : list.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      </div>
    </div>
  );
}

function AddReview() {
  const upsert = useApp((s) => s.upsert);
  const [mode, setMode] = useState<"one" | "many">("one");
  const [platform, setPlatform] = useState<ReviewPlatform>("baemin");
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const parsed = useMemo(() => (mode === "many" ? parseBulkReviews(text, rating) : []), [mode, text, rating]);

  const add = () => {
    if (mode === "one") upsert("reviews", makeReview(text.trim(), rating, platform, author));
    else for (const r of parsed) upsert("reviews", makeReview(r.text, r.rating, platform));
    setAdded(mode === "one" ? "리뷰를 추가했습니다." : `리뷰 ${parsed.length}건을 추가했습니다.`);
    setText("");
    setAuthor("");
  };

  return (
    <Card title="리뷰 추가" right={<Segmented value={mode} onChange={(m) => (setMode(m), setAdded(null))} options={[{ id: "one", label: "1건" }, { id: "many", label: "여러 건" }]} />}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Segmented value={platform} onChange={setPlatform} options={(Object.keys(PLATFORM) as ReviewPlatform[]).map((p) => ({ id: p, label: PLATFORM[p] }))} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? "text-warn" : "text-line"}`} aria-label={`${n}점`}>
                ★
              </button>
            ))}
          </div>
          {mode === "many" && <span className="text-xs text-ink-2">별점 표기가 없는 리뷰에 적용</span>}
        </div>
        {mode === "one" && (
          <Field label="작성자(선택)">
            <input className={inputCls} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
        )}
        <Field label={mode === "one" ? "리뷰 내용" : "리뷰 여러 개 (빈 줄로 구분)"} hint={mode === "many" ? "★★★★☆, 별점 4, 4점, 4/5 같은 표기는 별점으로 인식합니다." : undefined}>
          <textarea
            className={ic(mode === "one" ? "h-28" : "h-44")}
            value={text}
            onChange={(e) => (setText(e.target.value), setAdded(null))}
            placeholder={mode === "one" ? "리뷰를 복사해서 붙여넣으세요" : "★★★★★ 라떼 맛있어요\n\n별점 2 배달이 너무 늦었어요"}
          />
        </Field>
        {mode === "many" && parsed.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-auto text-xs">
            {parsed.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className={`shrink-0 ${r.ratingDetected ? "text-warn" : "text-ink-2"}`}>{"★".repeat(r.rating)}</span>
                <span className="truncate">{r.text}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={add} disabled={mode === "one" ? !text.trim() : parsed.length === 0}>
            {mode === "one" ? "추가하고 분석" : `${parsed.length}건 추가하고 분석`}
          </Button>
          {added && <span className="text-sm text-good">{added}</span>}
        </div>
      </div>
    </Card>
  );
}

/** 답글 대기 리뷰 전체의 초안을 차례로 만든다 (AI 호출이 몰리지 않게 한 번에 1건) */
function BulkDraft() {
  const reviews = useApp((s) => s.reviews);
  const targets = reviews.filter((r) => r.status === "pending" && !r.reply);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  if (targets.length === 0 && !progress) return null;
  const run = async () => {
    const list = [...targets];
    setProgress({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      const current = useApp.getState().reviews.find((r) => r.id === list[i].id);
      if (current && !current.reply) useApp.getState().upsert("reviews", await draftReply(current));
      setProgress({ done: i + 1, total: list.length });
    }
    setTimeout(() => setProgress(null), 1500);
  };
  return (
    <Button size="sm" variant="ghost" onClick={run} disabled={!!progress}>
      {progress ? `초안 작성 중 ${progress.done}/${progress.total}` : `초안 없는 ${targets.length}건 한 번에 작성`}
    </Button>
  );
}

function KeywordReport() {
  const reviews = useApp((s) => s.reviews);
  const menus = useApp((s) => s.menus);
  const stats = useMemo(() => {
    const pos = new Map<string, number>();
    const neg = new Map<string, number>();
    const menuNeg = new Map<string, number>();
    for (const r of reviews) {
      const target = r.sentiment === "negative" ? neg : pos;
      for (const k of r.keywords) target.set(k, (target.get(k) ?? 0) + 1);
      if (r.sentiment === "negative") for (const m of r.menuIds) menuNeg.set(m, (menuNeg.get(m) ?? 0) + 1);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const avg = reviews.length ? reviews.reduce((t, r) => t + r.rating, 0) / reviews.length : 0;
    const thisMonth = todayLocal().slice(0, 7);
    const months = Array.from({ length: 6 }, (_, i) => addMonths(thisMonth, i - 5)).map((m) => {
      const rs = reviews.filter((r) => r.createdAt.startsWith(m));
      return { month: m, count: rs.length, avg: rs.length ? rs.reduce((t, r) => t + r.rating, 0) / rs.length : null };
    });
    return { pos: top(pos), neg: top(neg), menuNeg: top(menuNeg), avg, months };
  }, [reviews]);

  return (
    <Card title="키워드 리포트">
      <p className="text-sm">
        평균 별점 <b>{stats.avg.toFixed(2)}</b> · 리뷰 {reviews.length}건
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex flex-wrap gap-1">
          <span className="w-14 text-xs text-ink-2">칭찬</span>
          {stats.pos.map(([k, n]) => (
            <Badge key={k} tone="good">
              {k} {n}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="w-14 text-xs text-ink-2">불만</span>
          {stats.neg.length === 0 ? <span className="text-xs text-ink-2">없음</span> : stats.neg.map(([k, n]) => (
            <Badge key={k} tone="bad">
              {k} {n}
            </Badge>
          ))}
        </div>
        {stats.menuNeg.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="w-14 text-xs text-ink-2">문제 메뉴</span>
            {stats.menuNeg.map(([id, n]) => (
              <Badge key={id} tone="bad">
                {menus.find((m) => m.id === id)?.name ?? "?"} {n}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <h3 className="mt-4 mb-1 text-xs font-semibold text-ink-2">월별 별점</h3>
      <table className="w-full text-xs tabular">
        <tbody>
          {stats.months.map((m) => (
            <tr key={m.month}>
              <td className="w-12 py-0.5 text-ink-2">{Number(m.month.slice(5))}월</td>
              <td className="py-0.5">
                {m.avg !== null ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                      <div className="h-1.5 rounded-full bg-series-1" style={{ width: `${(m.avg / 5) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right">{m.avg.toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-ink-2">-</span>
                )}
              </td>
              <td className="w-10 text-right text-ink-2">{m.count}건</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-ink-2">부정 리뷰가 반복되는 메뉴는 메뉴 분석의 ‘품질 점검’ 제안으로 자동 연결됩니다.</p>
    </Card>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const menus = useApp((s) => s.menus);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const menuNames = review.menuIds.map((id) => menus.find((m) => m.id === id)?.name).filter((x): x is string => !!x);
  const s = SENT[review.sentiment];

  const draft = async () => {
    setLoading(true);
    upsert("reviews", await draftReply(review));
    setLoading(false);
  };

  const copy = async () => {
    if (!review.reply) return;
    try {
      await navigator.clipboard.writeText(review.reply);
    } catch {
      // 클립보드 접근이 막힌 환경: 답글 칸을 선택해 직접 복사하도록 한다
      replyRef.current?.select();
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className={review.sentiment === "negative" && review.status !== "posted" ? "border-bad/60" : ""}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge tone="brand">{PLATFORM[review.platform]}</Badge>
        <span className="text-warn">{"★".repeat(review.rating)}</span>
        <span className="text-ink-2">
          {review.author ?? "익명"} · {review.createdAt}
        </span>
        <Badge tone={s.tone}>{s.label}</Badge>
        {menuNames.map((n) => (
          <Badge key={n}>{n}</Badge>
        ))}
        {review.keywords.map((k) => (
          <Badge key={k}>#{k}</Badge>
        ))}
        {review.status === "posted" && <Badge tone="good">게시 완료</Badge>}
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap">{review.text}</p>

      {review.reply !== undefined && (
        <div className="mt-3">
          <textarea
            ref={replyRef}
            className={ic("h-28")}
            value={review.reply}
            onChange={(e) => upsert("reviews", { ...review, reply: e.target.value })}
            aria-label="답글"
          />
          {review.replySource && review.status !== "posted" && (
            <p className="mt-1 text-[11px] text-ink-2">{review.replySource === "ai" ? "AI 초안" : "기본 문장 초안 (AI를 쓸 수 없어 템플릿으로 작성)"} · 수정 후 복사하세요.</p>
          )}
          {review.sentiment === "negative" && review.status !== "posted" && (
            <p className="mt-1 text-xs text-bad">부정 리뷰입니다. 사실관계(누락·이물질 등)를 확인하고, 보상 여부는 사장님이 직접 판단해 덧붙이세요.</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={draft} disabled={loading}>
          {loading ? "작성 중…" : review.reply ? "다시 생성" : "답글 초안 만들기"}
        </Button>
        {review.reply && (
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? "복사됨 ✓" : "복사"}
          </Button>
        )}
        {review.reply && review.status !== "posted" && (
          <Button size="sm" variant="ghost" onClick={() => upsert("reviews", { ...review, status: "posted" })}>
            게시 완료로 표시
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => (await askConfirm("리뷰를 삭제할까요?", { confirmLabel: "삭제", danger: true })) && remove("reviews", review.id)}>
          삭제
        </Button>
      </div>
    </Card>
  );
}
