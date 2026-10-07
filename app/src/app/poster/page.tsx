"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { useMenuAnalysis } from "@/lib/hooks";
import { PURPOSES, templateCopies, type PosterCopy, type PosterPurpose } from "@/lib/domain/poster";
import { Badge, Button, Card, Field, PageHeader, Segmented, ic, inputCls } from "@/components/ui";
import { won } from "@/lib/format";
import { platform, takeRouteParam } from "@/lib/platform";

type Size = "feed" | "story" | "a4";
type Style = "classic" | "bold" | "minimal";
const SIZES: Record<Size, { w: number; h: number; label: string }> = {
  feed: { w: 1080, h: 1080, label: "인스타 피드 1:1" },
  story: { w: 1080, h: 1920, label: "스토리 9:16" },
  a4: { w: 1240, h: 1754, label: "A4 매장 POP" },
};

export default function PosterPage() {
  const menus = useApp((s) => s.menus).filter((m) => !m.isSub);
  const store = useApp((s) => s.store);
  const reviews = useApp((s) => s.reviews);
  const analysis = useMenuAnalysis(56);
  const puzzles = analysis.stats.filter((s) => s.quadrant === "puzzle");

  const [menuId, setMenuId] = useState(() => {
    const q = takeRouteParam("menu");
    return q && menus.some((m) => m.id === q) ? q : (puzzles[0]?.menu.id ?? menus[0]?.id ?? "");
  });
  const menu = menus.find((m) => m.id === menuId);
  const [purpose, setPurpose] = useState<PosterPurpose>("today");
  const [size, setSize] = useState<Size>("feed");
  const [style, setStyle] = useState<Style>("classic");
  // 문구는 (메뉴, 목적) 조합별로 관리한다. 조합이 바뀌면 템플릿 기본 문구로 돌아간다.
  const copyKey = `${menuId}|${purpose}`;
  const [edited, setEdited] = useState<{ key: string; copy: PosterCopy; options: PosterCopy[]; source: "ai" | "template" | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [showPrice, setShowPrice] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const praise = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reviews)
      if (r.sentiment === "positive" && r.menuIds.includes(menuId)) for (const k of r.keywords) counts.set(k, (counts.get(k) ?? 0) + 1);
    const words: Record<string, string> = { 맛: "진한 맛", 양: "넉넉한 양", 포장: "꼼꼼한 포장", 배달: "빠른 배달", 친절: "따뜻한 서비스", 분위기: "아늑한 공간", 가격: "착한 가격", 재방문: "재주문 맛" };
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => words[k] ?? k);
  }, [reviews, menuId]);

  const defaults = useMemo(() => (menu ? templateCopies(menu.name, purpose, praise) : []), [menu, purpose, praise]);
  const current = edited?.key === copyKey ? edited : { key: copyKey, copy: defaults[0] ?? { headline: "", sub: "" }, options: defaults, source: null };
  const { copy, options, source: copySource } = current;
  const setCopy = (c: PosterCopy) => setEdited({ ...current, copy: c });

  const suggest = async () => {
    if (!menu) return;
    setLoading(true);
    const copies = await platform().posterCopies({ storeName: store.name, menuName: menu.name, description: menu.description, price: menu.price, purpose, praise });
    const list = copies ?? templateCopies(menu.name, purpose, praise);
    setEdited({ key: copyKey, copy: list[0], options: list, source: copies ? "ai" : "template" });
    setLoading(false);
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !menu) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) drawPoster(c, { size, style, brand: store.brandColor, storeName: store.name, menuName: menu.name, price: showPrice ? menu.price : null, badge: PURPOSES.find((p) => p.id === purpose)!.badge, copy, photo });
    });
    return () => {
      cancelled = true;
    };
  }, [size, style, store.brandColor, store.name, menu, showPrice, purpose, copy, photo]);

  const onPhoto = (f: File) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setPhoto(img);
    img.src = url;
  };

  const toBlob = () => new Promise<Blob | null>((r) => (canvasRef.current ? canvasRef.current.toBlob(r, "image/png") : r(null)));

  const download = async () => {
    const blob = await toBlob();
    if (blob) await platform().saveFile(`${store.name}_${menu?.name}_${SIZES[size].label.split(" ")[0]}.png`, blob);
  };

  const share = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], "poster.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: copy.headline });
    } catch {
      // 공유 취소 또는 미지원: 저장으로 대체
    }
    await download();
  };

  if (!menu) return <p className="text-sm text-ink-2">메뉴를 먼저 등록하세요.</p>;

  return (
    <div>
      <PageHeader title="홍보 포스터" desc="메뉴를 고르고 목적을 정하면 문구와 디자인이 자동으로 채워집니다. 사진만 올리면 끝." />
      {puzzles.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-2">🧩 홍보 추천(숨은 고마진 메뉴):</span>
          {puzzles.map((p) => (
            <button key={p.menu.id} onClick={() => setMenuId(p.menu.id)}>
              <Badge tone="brand">{p.menu.name}</Badge>
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <div className="space-y-4">
            <Field label="메뉴">
              <select className={inputCls} value={menuId} onChange={(e) => setMenuId(e.target.value)}>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({won(m.price)})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="목적">
              <Segmented value={purpose} onChange={setPurpose} options={PURPOSES.map((p) => ({ id: p.id, label: p.label }))} />
            </Field>
            <Field label="사이즈">
              <Segmented value={size} onChange={setSize} options={(Object.keys(SIZES) as Size[]).map((s) => ({ id: s, label: SIZES[s].label }))} />
            </Field>
            <Field label="스타일">
              <Segmented
                value={style}
                onChange={setStyle}
                options={[
                  { id: "classic", label: "클래식" },
                  { id: "bold", label: "볼드" },
                  { id: "minimal", label: "미니멀" },
                ]}
              />
            </Field>
            <Field label="메뉴 사진" hint="밝은 곳에서 위에서 찍은 사진이 잘 어울려요. 사진이 없으면 브랜드 색 배경을 씁니다.">
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} className="text-sm" />
                {photo && (
                  <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>
                    사진 제거
                  </Button>
                )}
              </div>
            </Field>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-2">문구</span>
                <Button size="sm" variant="ghost" onClick={suggest} disabled={loading}>
                  {loading ? "생성 중…" : "✨ AI 문구 추천"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {options.map((o, i) => (
                  <button key={i} onClick={() => setCopy(o)} className={`rounded-lg border px-2 py-1 text-left text-xs ${o.headline === copy.headline ? "border-brand" : "border-line"}`}>
                    {o.headline}
                  </button>
                ))}
              </div>
              {copySource && <p className="mt-1 text-[11px] text-ink-2">{copySource === "ai" ? "AI 추천 문구" : "기본 문구 (AI를 쓸 수 없어 템플릿으로 작성)"}</p>}
              <input className={ic("mt-2")} value={copy.headline} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} aria-label="헤드라인" />
              <input className={ic("mt-2")} value={copy.sub} onChange={(e) => setCopy({ ...copy, sub: e.target.value })} aria-label="서브 문구" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> 가격 표시
            </label>
          </div>
        </Card>
        <Card
          title="미리보기"
          right={
            <div className="flex gap-2">
              {platform().canShareFiles && (
                <Button size="sm" variant="ghost" onClick={share}>
                  공유
                </Button>
              )}
              <Button size="sm" onClick={download}>
                PNG 저장
              </Button>
            </div>
          }
        >
          <canvas ref={canvasRef} className="mx-auto block h-auto max-h-[70vh] w-auto max-w-full rounded-lg shadow" />
        </Card>
      </div>
    </div>
  );
}

interface DrawArgs {
  size: Size;
  style: Style;
  brand: string;
  storeName: string;
  menuName: string;
  price: number | null;
  badge: string;
  copy: PosterCopy;
  photo: HTMLImageElement | null;
}

const FONT = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

function drawPoster(c: HTMLCanvasElement, a: DrawArgs) {
  const { w, h } = SIZES[a.size];
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const u = w / 1080; // 기준 단위

  const dark = a.style === "bold";
  const bg = a.style === "minimal" ? "#f7f3ee" : dark ? "#1d1611" : a.brand;
  const fg = a.style === "minimal" ? "#2a211b" : "#ffffff";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // 사진 영역
  const photoBox =
    a.style === "minimal"
      ? { x: 80 * u, y: 80 * u, w: w - 160 * u, h: h * 0.55 }
      : a.style === "bold"
        ? { x: 0, y: 0, w, h }
        : { x: 0, y: 0, w, h: h * 0.62 };
  if (a.photo) {
    const { naturalWidth: iw, naturalHeight: ih } = a.photo;
    const scale = Math.max(photoBox.w / iw, photoBox.h / ih);
    const sw = photoBox.w / scale;
    const sh = photoBox.h / scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);
    ctx.clip();
    ctx.drawImage(a.photo, (iw - sw) / 2, (ih - sh) / 2, sw, sh, photoBox.x, photoBox.y, photoBox.w, photoBox.h);
    ctx.restore();
    if (a.style === "bold") {
      const g = ctx.createLinearGradient(0, h * 0.35, 0, h);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  } else if (a.style !== "bold") {
    ctx.fillStyle = a.style === "minimal" ? "#e8dfd3" : "rgba(255,255,255,0.12)";
    ctx.fillRect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);
    ctx.font = `${200 * u}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("☕", photoBox.x + photoBox.w / 2, photoBox.y + photoBox.h / 2);
  }

  // 배지
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = `700 ${34 * u}px ${FONT}`;
  const bw = ctx.measureText(a.badge).width + 48 * u;
  const bx = 80 * u;
  const by = a.style === "minimal" ? 120 * u : 80 * u;
  ctx.fillStyle = a.style === "minimal" ? a.brand : "#ffffff";
  roundRect(ctx, bx, by, bw, 64 * u, 32 * u);
  ctx.fill();
  ctx.fillStyle = a.style === "minimal" ? "#ffffff" : a.style === "bold" ? "#1d1611" : a.brand;
  ctx.fillText(a.badge, bx + 24 * u, by + 44 * u);

  // 텍스트 블록
  const textTop = a.style === "minimal" ? photoBox.y + photoBox.h + 90 * u : a.style === "bold" ? h * 0.62 : photoBox.h + 110 * u;
  ctx.fillStyle = fg;
  ctx.font = `800 ${(a.size === "feed" ? 76 : 92) * u}px ${FONT}`;
  const lines = wrap(ctx, a.copy.headline, w - 160 * u);
  let y = textTop;
  for (const line of lines.slice(0, 2)) {
    ctx.fillText(line, 80 * u, y);
    y += (a.size === "feed" ? 92 : 110) * u;
  }
  ctx.globalAlpha = 0.85;
  ctx.font = `500 ${(a.size === "feed" ? 38 : 46) * u}px ${FONT}`;
  for (const line of wrap(ctx, a.copy.sub, w - 160 * u).slice(0, 2)) {
    ctx.fillText(line, 80 * u, y);
    y += 56 * u;
  }
  ctx.globalAlpha = 1;

  // 하단: 메뉴명·가격·가게명
  const footY = h - 80 * u;
  ctx.font = `700 ${40 * u}px ${FONT}`;
  ctx.fillText(a.menuName + (a.price ? `  ${a.price.toLocaleString()}원` : ""), 80 * u, footY);
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.75;
  ctx.font = `600 ${34 * u}px ${FONT}`;
  ctx.fillText(a.storeName, w - 80 * u, footY);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
