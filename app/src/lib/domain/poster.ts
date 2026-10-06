export type PosterPurpose = "new" | "season" | "event" | "today";

export const PURPOSES: { id: PosterPurpose; label: string; badge: string }[] = [
  { id: "new", label: "신메뉴 출시", badge: "NEW" },
  { id: "season", label: "시즌 한정", badge: "LIMITED" },
  { id: "event", label: "할인 이벤트", badge: "EVENT" },
  { id: "today", label: "오늘의 추천", badge: "TODAY'S PICK" },
];

export interface PosterCopy {
  headline: string;
  sub: string;
}

export function templateCopies(menuName: string, purpose: PosterPurpose, praise: string[]): PosterCopy[] {
  const p = praise[0];
  const praiseLine = p ? `손님들이 먼저 알아본 ${p}` : "한 모금에 반하는 맛";
  switch (purpose) {
    case "new":
      return [
        { headline: `새로 나왔어요, ${menuName}`, sub: "오늘부터 만나보세요" },
        { headline: `${menuName} 첫 출시`, sub: praiseLine },
        { headline: `이번엔 ${menuName}`, sub: "새로운 한 잔이 기다리고 있어요" },
      ];
    case "season":
      return [
        { headline: `지금만 ${menuName}`, sub: "계절이 지나면 사라져요" },
        { headline: `시즌 한정 ${menuName}`, sub: praiseLine },
        { headline: `${menuName}, 이 계절의 맛`, sub: "놓치기 전에 꼭 드셔보세요" },
      ];
    case "event":
      return [
        { headline: `${menuName} 특별 이벤트`, sub: "기간 한정 혜택을 놓치지 마세요" },
        { headline: `오늘은 ${menuName} 데이`, sub: praiseLine },
        { headline: `${menuName} 할인 중`, sub: "가볍게 들러 한 잔 하세요" },
      ];
    default:
      return [
        { headline: `오늘의 추천 ${menuName}`, sub: praiseLine },
        { headline: `고민될 땐 ${menuName}`, sub: "사장님이 자신 있게 추천해요" },
        { headline: `${menuName} 어때요?`, sub: "오늘 기분에 딱 맞는 한 잔" },
      ];
  }
}

export function buildCopyPrompt(args: {
  storeName: string;
  menuName: string;
  description?: string;
  price: number;
  purpose: PosterPurpose;
  praise: string[];
}): { system: string; user: string } {
  const purpose = PURPOSES.find((p) => p.id === args.purpose)?.label ?? "";
  return {
    system:
      '당신은 동네 카페의 홍보 카피라이터입니다. 포스터용 카피 3안을 JSON 배열로만 출력하세요. 형식: [{"headline":"...","sub":"..."}]. headline은 14자 이내, sub는 22자 이내. 과장 광고·허위 효능 표현 금지. 가격은 포스터에 별도 표기되므로 카피에 넣지 마세요.',
    user: [
      `카페: ${args.storeName}`,
      `메뉴: ${args.menuName}${args.description ? ` (${args.description})` : ""}`,
      `목적: ${purpose}`,
      args.praise.length ? `리뷰에서 자주 나온 칭찬: ${args.praise.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function parseCopies(text: string): PosterCopy[] | null {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return null;
    const out = arr
      .filter((x) => x && typeof x.headline === "string")
      .map((x) => ({ headline: String(x.headline), sub: String(x.sub ?? "") }));
    return out.length ? out : null;
  } catch {
    return null;
  }
}
