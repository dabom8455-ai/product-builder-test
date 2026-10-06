import type { Menu, Sentiment, Tone } from "../types";

// 키워드 사전: 리뷰에서 자주 나오는 카페 관련 주제
const KEYWORDS: { key: string; pos: string[]; neg: string[] }[] = [
  { key: "맛", pos: ["맛있", "맛나", "고소", "진하", "향이 좋", "달달", "부드럽", "존맛", "jmt", "최고"], neg: ["맛없", "싱겁", "밍밍", "쓰기만", "시큼", "비리", "탄맛", "너무 달", "너무 써"] },
  { key: "양", pos: ["양이 많", "넉넉", "푸짐", "양 많"], neg: ["양이 적", "양이 너무 적", "적어요", "반밖에", "얼음만"] },
  { key: "포장", pos: ["포장 꼼꼼", "포장이 꼼꼼", "깔끔하게 포장", "안 새", "포장도 예쁘"], neg: ["샜", "새서", "흘러", "쏟아", "넘쳐", "포장이 엉망", "뚜껑"] },
  { key: "배달", pos: ["빨리 왔", "빠른 배달", "배달 빠", "금방 왔"], neg: ["늦게 왔", "배달이 늦", "한시간", "1시간", "식어서", "다 녹아", "녹았"] },
  { key: "친절", pos: ["친절", "상냥", "응대 좋", "서비스 좋", "사장님 좋"], neg: ["불친절", "퉁명", "무시", "응대가 별로", "기분 나빴"] },
  { key: "분위기", pos: ["분위기", "인테리어", "예쁜 카페", "아늑", "조용", "감성"], neg: ["시끄럽", "좁아", "더럽", "지저분"] },
  { key: "가격", pos: ["가성비", "저렴", "착한 가격"], neg: ["비싸", "가격 대비", "창렬"] },
  { key: "재방문", pos: ["또 올", "재방문", "단골", "또 시킬", "재주문", "또 주문", "자주 시켜"], neg: ["다시는", "재주문 안", "안 시킬"] },
];

const NEG_HINT = ["별로", "실망", "아쉽", "최악", "다신", "환불", "잘못", "빠졌", "누락", "안 왔", "머리카락", "이물"];

export interface ReviewAnalysis {
  sentiment: Sentiment;
  keywords: string[];
  negKeywords: string[];
  menuIds: string[];
  issues: string[];
}

function normalize(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** 메뉴명/별칭 매칭. "아이스 아메리카노" → "아아" 등 흔한 줄임말 포함 */
export function menuAliases(name: string): string[] {
  const n = normalize(name);
  const aliases = [n];
  const base = n.replace(/^(아이스|ice|핫|hot)/, "");
  if (base !== n && base.length >= 2) aliases.push(base);
  if (n === "아이스아메리카노") aliases.push("아아");
  if (n === "아메리카노" || n === "핫아메리카노") aliases.push("뜨아");
  if (n.endsWith("라떼")) aliases.push(n.replace("라떼", "라테"));
  return aliases;
}

export function matchMenus(text: string, menus: Menu[]): string[] {
  const t = normalize(text);
  const hits: { id: string; len: number }[] = [];
  for (const m of menus) {
    if (m.isSub) continue;
    const a = menuAliases(m.name).find((al) => t.includes(al));
    if (a) hits.push({ id: m.id, len: a.length });
  }
  // "바닐라라떼"가 맞으면 "라떼" 단독 매칭은 제외 — 더 긴 이름이 포함하는 짧은 매칭 제거
  return hits
    .filter((h) => !hits.some((o) => o.len > h.len && normalize(menus.find((m) => m.id === o.id)!.name).includes(normalize(menus.find((m) => m.id === h.id)!.name))))
    .map((h) => h.id);
}

export function analyzeReview(text: string, rating: number, menus: Menu[]): ReviewAnalysis {
  const t = text.toLowerCase();
  const keywords: string[] = [];
  const negKeywords: string[] = [];
  let pos = 0;
  let neg = 0;
  for (const k of KEYWORDS) {
    const p = k.pos.some((w) => t.includes(w));
    const n = k.neg.some((w) => t.includes(w));
    if (p) {
      keywords.push(k.key);
      pos++;
    }
    if (n) {
      negKeywords.push(k.key);
      neg++;
    }
  }
  const hint = NEG_HINT.filter((w) => t.includes(w));
  neg += hint.length;
  const issues = [...negKeywords];
  if (hint.some((w) => ["빠졌", "누락", "안 왔"].includes(w))) issues.push("누락");
  if (hint.some((w) => ["머리카락", "이물"].includes(w))) issues.push("이물질");

  let sentiment: Sentiment;
  if (rating <= 2 || (rating === 3 && neg > pos) || neg >= pos + 2) sentiment = "negative";
  else if (rating >= 4 && neg <= pos) sentiment = "positive";
  else sentiment = "neutral";

  return { sentiment, keywords, negKeywords, menuIds: matchMenus(text, menus), issues: [...new Set(issues)] };
}

// ---------- 템플릿 기반 답글 (AI 키가 없을 때 사용) ----------

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number, avoid: string[] = []): T {
  for (let i = 0; i < arr.length; i++) {
    const c = arr[(seed + i) % arr.length];
    if (!avoid.some((a) => typeof c === "string" && a.includes(c as string))) return c;
  }
  return arr[seed % arr.length];
}

const TONE = {
  friendly: {
    open: ["안녕하세요! {store}입니다 😊", "{author}님 반가워요! {store}입니다 ☕", "와 리뷰 감사해요! {store}입니다 🙌"],
    close: ["다음에 또 만나요! 💛", "또 놀러 오세요, 기다릴게요! ☕", "오늘도 좋은 하루 보내세요 😊"],
  },
  polite: {
    open: ["안녕하세요, {store}입니다.", "{author} 고객님, {store}입니다.", "소중한 리뷰 감사드립니다. {store}입니다."],
    close: ["다음 방문에도 정성을 다하겠습니다. 감사합니다.", "늘 좋은 커피로 보답하겠습니다. 감사합니다.", "건강하고 행복한 하루 되세요. 감사합니다."],
  },
  witty: {
    open: ["띵동~ {store} 사장님 등장! 🙋", "{author}님 리뷰 보고 원두가 춤춰요 💃 {store}입니다!", "리뷰 알림에 심장이 두근! {store}입니다 💓"],
    close: ["다음 잔은 더 맛있게 내릴게요 ☕🔥", "또 오시면 저희 머신이 반가워할 거예요 🤖", "재방문 도장 꾹 찍어 드릴게요 🫶"],
  },
} as const;

const POS_BODY: Record<string, string[]> = {
  맛: ["{menu} 맛있게 즐겨 주셨다니 정말 기뻐요.", "{menu} 맛을 알아봐 주셔서 감사해요. 매일 아침 맛을 확인하며 준비하고 있어요."],
  양: ["넉넉하게 드리려고 신경 쓰는데 알아봐 주셔서 감사해요."],
  포장: ["포장 하나하나 꼼꼼히 챙기고 있는데 알아봐 주셔서 뿌듯해요."],
  배달: ["빠르게 받아보셨다니 다행이에요."],
  친절: ["따뜻한 말씀에 저희가 더 힘이 납니다."],
  분위기: ["공간도 마음에 들어 하셔서 감사해요. 편하게 쉬다 가세요."],
  가격: ["좋은 재료로 부담 없는 가격을 지키려 노력하고 있어요."],
  재방문: ["다시 찾아 주신다니 그보다 큰 응원은 없어요."],
};

const NEG_BODY: Record<string, string> = {
  맛: "{menu} 맛이 기대에 미치지 못해 죄송합니다. 레시피와 추출 상태를 다시 점검하겠습니다.",
  양: "양이 아쉬우셨다니 죄송합니다. 제공 기준을 다시 확인하겠습니다.",
  포장: "포장 문제로 불편을 드려 정말 죄송합니다. 실링과 뚜껑 고정을 한 번 더 확인하도록 하겠습니다.",
  배달: "배달 과정에서 불편을 드려 죄송합니다. 조리 시간과 라이더 배차를 함께 점검하겠습니다.",
  친절: "응대로 불편을 드려 진심으로 죄송합니다. 직원 교육을 다시 진행하겠습니다.",
  분위기: "매장 이용에 불편을 드려 죄송합니다. 청결과 환경을 개선하겠습니다.",
  가격: "가격에 대한 의견 감사합니다. 더 만족하실 수 있는 구성을 고민하겠습니다.",
  재방문: "실망을 드려 죄송합니다. 다시 기회를 주신다면 꼭 달라진 모습 보여드리겠습니다.",
  누락: "주문하신 메뉴가 누락되어 정말 죄송합니다. 매장으로 연락 주시면 바로 조치해 드리겠습니다.",
  이물질: "위생 문제로 큰 불쾌감을 드려 진심으로 사과드립니다. 즉시 위생 점검을 진행했으며, 매장으로 연락 주시면 성심껏 조치하겠습니다.",
};

export interface ReplyInput {
  storeName: string;
  tone: Tone;
  text: string;
  rating: number;
  author?: string;
  analysis: ReviewAnalysis;
  menuNames: string[];
  recentReplies: string[];
}

export function templateReply(input: ReplyInput): string {
  const { analysis, tone } = input;
  const seed = hash(input.text);
  const t = TONE[tone];
  const menu = input.menuNames[0] ?? "주문하신 메뉴";
  const author = input.author?.trim() || "고객";
  const fill = (s: string) => s.replaceAll("{store}", input.storeName).replaceAll("{menu}", menu).replaceAll("{author}", author);

  const parts: string[] = [fill(pick(t.open as unknown as string[], seed, input.recentReplies))];

  if (analysis.sentiment === "negative") {
    const issues = analysis.issues.length ? analysis.issues : ["맛"];
    parts[0] = fill(TONE.polite.open[seed % 3]); // 부정 리뷰는 말투 설정과 무관하게 정중하게
    parts.push("먼저 불편을 드려 죄송합니다.");
    for (const i of issues.slice(0, 2)) if (NEG_BODY[i]) parts.push(fill(NEG_BODY[i]));
    parts.push("남겨 주신 의견은 바로 개선에 반영하겠습니다.");
    parts.push(fill(TONE.polite.close[seed % 3]));
  } else {
    const keys = analysis.keywords.length ? analysis.keywords : ["맛"];
    for (const k of keys.slice(0, 2)) {
      const bodies = POS_BODY[k];
      if (bodies) parts.push(fill(pick(bodies, seed + k.length, input.recentReplies)));
    }
    if (analysis.sentiment === "neutral") parts.push("혹시 아쉬운 점이 있으셨다면 편하게 말씀해 주세요. 더 나아지도록 하겠습니다.");
    parts.push(fill(pick(t.close as unknown as string[], seed >> 3, input.recentReplies)));
  }
  return parts.join(" ");
}

export function buildReplyPrompt(input: ReplyInput): { system: string; user: string } {
  const toneDesc = { friendly: "친근하고 따뜻한 말투, 이모지 1~2개", polite: "정중한 존댓말, 이모지 없음", witty: "재치 있고 유쾌한 말투, 이모지 1~3개" }[input.tone];
  const system = [
    `당신은 카페 "${input.storeName}"의 사장님을 대신해 배달앱/네이버 리뷰에 답글 초안을 쓰는 도우미입니다.`,
    `말투: ${toneDesc}. 부정 리뷰에는 말투 설정과 무관하게 정중하게 사과하고 구체적인 개선 의지를 밝히세요.`,
    "규칙: 2~4문장, 한국어. 리뷰에 언급된 메뉴나 구체적 내용을 자연스럽게 짚을 것. 할인·쿠폰·환불·보상을 약속하지 말 것(사장님 승인 필요). 고객을 탓하거나 변명하지 말 것. 최근 답글과 같은 문장을 반복하지 말 것.",
    "답글 본문만 출력하세요.",
  ].join("\n");
  const user = [
    `별점: ${input.rating}/5`,
    input.author ? `작성자: ${input.author}` : "",
    `리뷰: ${input.text}`,
    input.menuNames.length ? `언급 메뉴: ${input.menuNames.join(", ")}` : "",
    `분석: 감정=${input.analysis.sentiment}, 긍정 키워드=${input.analysis.keywords.join(",") || "없음"}, 불만=${input.analysis.issues.join(",") || "없음"}`,
    input.recentReplies.length ? `최근 답글(반복 금지):\n- ${input.recentReplies.slice(0, 5).join("\n- ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}
