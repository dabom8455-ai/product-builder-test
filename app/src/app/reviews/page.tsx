"use client";

import { useMemo, useState } from "react";
import { newId, useApp } from "@/lib/store";
import type { Review, ReviewPlatform } from "@/lib/types";
import { analyzeReview, templateReply, type ReplyInput } from "@/lib/domain/review";
import { todayLocal } from "@/lib/dates";
import { Badge, Button, Card, Empty, Field, PageHeader, Segmented, ic, inputCls } from "@/components/ui";

const PLATFORM: Record<ReviewPlatform, string> = { naver: "네이버", baemin: "배민", coupang: "쿠팡이츠", etc: "기타" };
const SENT = { positive: { label: "긍정", tone: "good" }, neutral: { label: "중립", tone: "warn" }, negative: { label: "부정", tone: "bad" } } as const;

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
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { id: "todo", label: `답글 대기 ${reviews.filter((r) => r.status !== "posted").length}` },
              { id: "posted", label: "게시 완료" },
              { id: "all", label: "전체" },
            ]}
          />
          {list.length === 0 ? <Empty>리뷰가 없습니다.</Empty> : list.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      </div>
    </div>
  );
}

function AddReview() {
  const menus = useApp((s) => s.menus);
  const upsert = useApp((s) => s.upsert);
  const [platform, setPlatform] = useState<ReviewPlatform>("baemin");
  const [rating, setRating] = useState(5);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");

  const add = () => {
    const a = analyzeReview(text, rating, menus);
    upsert("reviews", {
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
    });
    setText("");
    setAuthor("");
  };

  return (
    <Card title="리뷰 추가">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Segmented value={platform} onChange={setPlatform} options={(Object.keys(PLATFORM) as ReviewPlatform[]).map((p) => ({ id: p, label: PLATFORM[p] }))} />
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? "text-warn" : "text-line"}`} aria-label={`${n}점`}>
              ★
            </button>
          ))}
        </div>
        <Field label="작성자(선택)">
          <input className={inputCls} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field label="리뷰 내용">
          <textarea className={ic("h-28")} value={text} onChange={(e) => setText(e.target.value)} placeholder="리뷰를 복사해서 붙여넣으세요" />
        </Field>
        <Button onClick={add} disabled={!text.trim()}>
          추가하고 분석
        </Button>
      </div>
    </Card>
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
    return { pos: top(pos), neg: top(neg), menuNeg: top(menuNeg), avg };
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
      <p className="mt-3 text-[11px] text-ink-2">부정 리뷰가 반복되는 메뉴는 메뉴 분석의 ‘품질 점검’ 제안으로 자동 연결됩니다.</p>
    </Card>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const store = useApp((s) => s.store);
  const menus = useApp((s) => s.menus);
  const reviews = useApp((s) => s.reviews);
  const upsert = useApp((s) => s.upsert);
  const remove = useApp((s) => s.remove);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"ai" | "template" | null>(null);
  const [copied, setCopied] = useState(false);
  const menuNames = review.menuIds.map((id) => menus.find((m) => m.id === id)?.name).filter((x): x is string => !!x);
  const s = SENT[review.sentiment];

  const draft = async () => {
    setLoading(true);
    const analysis = analyzeReview(review.text, review.rating, menus);
    const input: ReplyInput = {
      storeName: store.name,
      tone: store.tone,
      text: review.text,
      rating: review.rating,
      author: review.author,
      analysis,
      menuNames,
      recentReplies: reviews.filter((r) => r.reply && r.id !== review.id).map((r) => r.reply!).slice(-5),
    };
    let reply: string | null = null;
    try {
      const res = await fetch("/api/ai/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
      if (res.ok) reply = (await res.json()).reply;
    } catch {
      // 네트워크 오류 시 템플릿으로 대체
    }
    setSource(reply ? "ai" : "template");
    upsert("reviews", { ...review, reply: reply ?? templateReply(input), status: "drafted" });
    setLoading(false);
  };

  const copy = async () => {
    if (!review.reply) return;
    await navigator.clipboard.writeText(review.reply);
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
            className={ic("h-28")}
            value={review.reply}
            onChange={(e) => upsert("reviews", { ...review, reply: e.target.value })}
            aria-label="답글"
          />
          {source && <p className="mt-1 text-[11px] text-ink-2">{source === "ai" ? "AI 초안" : "템플릿 초안 (AI 키 미설정 또는 응답 실패)"} · 수정 후 복사하세요.</p>}
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
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => confirm("리뷰를 삭제할까요?") && remove("reviews", review.id)}>
          삭제
        </Button>
      </div>
    </Card>
  );
}
