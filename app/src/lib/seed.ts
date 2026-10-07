import type {
  Attendance,
  DayNote,
  Purchase,
  Shift,
  Channel,
  Employee,
  Expense,
  Ingredient,
  LaborRule,
  Menu,
  RecurringExpense,
  Review,
  SaleLine,
  Store,
} from "./types";
import { addDays, addMonths, dayOfWeek, weekStart } from "./dates";
import { theoreticalUsage } from "./domain/usage";

// 앱을 처음 열었을 때 바로 써볼 수 있는 샘플 카페 데이터. 설정 > 데이터에서 초기화할 수 있다.

export const DEFAULT_STORE: Store = {
  name: "카페 댐",
  tone: "friendly",
  brandColor: "#6b4f3a",
  over5Employees: false,
  vatMode: "general",
  channelFeeRate: { hall: 0.011, baemin: 0.098, coupang: 0.098, yogiyo: 0.127, naver: 0.03 },
  deliveryPackagingCost: 150,
  targetCostRatio: { drink: 0.3, dessert: 0.35 },
  monthlySalesTarget: 15_000_000,
  closedDays: [],
  replySignature: "",
};

// 2026년 기준. 4대보험 비율은 근사치이며 설정에서 조정한다.
export const DEFAULT_LABOR_RULE: LaborRule = {
  minWage: 10320,
  employeeInsuranceRate: 0.097,
  employerInsuranceRate: 0.107,
  freelanceTaxRate: 0.033,
};

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ing = (id: string, name: string, unit: string, packSize: number, packPrice: number, date: string): Ingredient => ({
  id,
  name,
  unit,
  packSize,
  packPrice,
  updatedAt: date,
});

export function buildSeed(today: string) {
  const ingredients: Ingredient[] = [
    ing("i-bean", "원두(블렌드)", "g", 1000, 28000, today),
    ing("i-milk", "우유", "ml", 1000, 2700, today),
    ing("i-oat", "오트밀크", "ml", 1000, 4500, today),
    ing("i-sugar", "설탕", "g", 1000, 1800, today),
    ing("i-vanilla", "바닐라 익스트랙", "ml", 100, 9000, today),
    ing("i-choco", "초코 파우더", "g", 1000, 18000, today),
    ing("i-earl", "얼그레이 티백", "개", 100, 25000, today),
    ing("i-sesame", "흑임자 페이스트", "g", 500, 15000, today),
    ing("i-cream", "생크림", "ml", 1000, 7500, today),
    ing("i-strawberry", "딸기", "g", 1000, 15000, today),
    ing("i-cheese", "크림치즈", "g", 1000, 14000, today),
    ing("i-butter", "버터", "g", 450, 9800, today),
    ing("i-flour", "박력분", "g", 1000, 2500, today),
    ing("i-egg", "계란", "개", 30, 8500, today),
    ing("i-ice", "얼음", "g", 1000, 300, today),
    ing("i-cup-ice", "아이스컵 16oz", "개", 50, 4250, today),
    ing("i-cup-hot", "핫컵 12oz", "개", 50, 3500, today),
    ing("i-lid", "컵 뚜껑", "개", 50, 1500, today),
    ing("i-straw", "빨대", "개", 50, 600, today),
    ing("i-box", "디저트 박스", "개", 20, 5000, today),
  ];

  const I = (refId: string, qty: number) => ({ refId, kind: "ingredient" as const, qty });
  const S = (refId: string, qty: number) => ({ refId, kind: "sub" as const, qty });
  const iceCup = [I("i-ice", 150), I("i-cup-ice", 1), I("i-lid", 1), I("i-straw", 1)];
  const menu = (m: Partial<Menu> & Pick<Menu, "id" | "name" | "category" | "price" | "recipe">): Menu => ({
    deliveryPrice: m.price + 500,
    isSub: false,
    yieldQty: 1,
    yieldUnit: "개",
    lossRate: 0.03,
    active: true,
    ...m,
  });

  const menus: Menu[] = [
    menu({ id: "s-vanilla", name: "바닐라시럽", category: "drink", price: 0, isSub: true, yieldQty: 1000, yieldUnit: "ml", recipe: [I("i-sugar", 600), I("i-vanilla", 20)] }),
    menu({ id: "s-cheesecake", name: "치즈케이크 1판", category: "dessert", price: 0, isSub: true, yieldQty: 8, yieldUnit: "조각", recipe: [I("i-cheese", 500), I("i-sugar", 120), I("i-egg", 3), I("i-cream", 200), I("i-flour", 30), I("i-butter", 50)] }),
    menu({ id: "m-americano", name: "아메리카노", category: "drink", price: 4000, recipe: [I("i-bean", 18), I("i-cup-hot", 1), I("i-lid", 1)], description: "고소한 블렌드 원두" }),
    menu({ id: "m-ice-americano", name: "아이스 아메리카노", category: "drink", price: 4500, recipe: [I("i-bean", 18), ...iceCup], description: "깔끔하고 시원한 한 잔" }),
    menu({ id: "m-latte", name: "카페라떼", category: "drink", price: 5000, recipe: [I("i-bean", 18), I("i-milk", 200), ...iceCup] }),
    menu({ id: "m-vanilla-latte", name: "바닐라라떼", category: "drink", price: 5500, recipe: [I("i-bean", 18), I("i-milk", 200), S("s-vanilla", 25), ...iceCup], description: "직접 끓인 바닐라빈 시럽" }),
    menu({ id: "m-oat-latte", name: "오트라떼", category: "drink", price: 5800, recipe: [I("i-bean", 18), I("i-oat", 200), ...iceCup] }),
    menu({ id: "m-choco", name: "초코라떼", category: "drink", price: 5500, recipe: [I("i-choco", 30), I("i-milk", 220), ...iceCup] }),
    menu({ id: "m-earlgrey-milktea", name: "얼그레이 밀크티", category: "drink", price: 6000, recipe: [I("i-earl", 2), I("i-milk", 200), I("i-sugar", 15), ...iceCup] }),
    menu({ id: "m-sesame-latte", name: "흑임자 라떼", category: "drink", price: 6300, recipe: [I("i-sesame", 30), I("i-milk", 200), ...iceCup], description: "고소한 국산 흑임자" }),
    menu({ id: "m-cheesecake", name: "뉴욕 치즈케이크", category: "dessert", price: 6500, recipe: [S("s-cheesecake", 1), I("i-box", 1)] }),
    menu({ id: "m-financier", name: "버터 휘낭시에", category: "dessert", price: 3200, recipe: [I("i-butter", 25), I("i-flour", 15), I("i-egg", 0.3), I("i-sugar", 15), I("i-box", 0.25)] }),
    menu({ id: "m-strawberry-cake", name: "딸기 생크림 케이크", category: "dessert", price: 7500, recipe: [I("i-strawberry", 60), I("i-cream", 50), I("i-flour", 20), I("i-egg", 0.5), I("i-sugar", 20), I("i-box", 1)] }),
    menu({ id: "m-earlgrey-pound", name: "얼그레이 파운드", category: "dessert", price: 4500, recipe: [I("i-butter", 40), I("i-flour", 40), I("i-egg", 1), I("i-sugar", 40), I("i-earl", 2), I("i-box", 1)] }),
  ];

  // 메뉴별 일 평균 판매량 (평일 기준)
  const popularity: Record<string, number> = {
    "m-ice-americano": 32,
    "m-americano": 10,
    "m-latte": 14,
    "m-vanilla-latte": 11,
    "m-oat-latte": 4,
    "m-choco": 5,
    "m-earlgrey-milktea": 5,
    "m-sesame-latte": 2,
    "m-cheesecake": 6,
    "m-financier": 8,
    "m-strawberry-cake": 3,
    "m-earlgrey-pound": 1.5,
  };
  const channelSplit: [Channel, number][] = [
    ["hall", 0.64],
    ["baemin", 0.2],
    ["coupang", 0.1],
    ["naver", 0.06],
  ];
  const dowFactor = [1.25, 0.85, 0.9, 0.95, 1.0, 1.15, 1.35]; // 일~토
  const rnd = mulberry32(20261006);
  const sales: SaleLine[] = [];
  const start = addDays(today, -62);
  for (let d = start; d < today; d = addDays(d, 1)) {
    const f = dowFactor[dayOfWeek(d)];
    for (const [menuId, base] of Object.entries(popularity)) {
      for (const [channel, share] of channelSplit) {
        const mean = base * f * share;
        const qty = Math.round(mean * (0.7 + rnd() * 0.6));
        if (qty > 0) sales.push({ id: `sl-${d}-${menuId}-${channel}`, date: d, channel, menuId, qty });
      }
    }
  }

  const employees: Employee[] = [
    { id: "e-minji", name: "김민지", hourlyWage: 10320, weeklyContractHours: 20, taxType: "insurance", contractSigned: true, pin: "1111", active: true, healthCertExpiry: addDays(today, 200) },
    { id: "e-seojun", name: "박서준", hourlyWage: 10500, weeklyContractHours: 15, taxType: "freelance", contractSigned: true, pin: "2222", active: true, healthCertExpiry: addDays(today, 20) },
    { id: "e-haneul", name: "이하늘", hourlyWage: 10320, weeklyContractHours: 10.5, taxType: "none", contractSigned: false, pin: "3333", active: true, healthCertExpiry: addDays(today, 90) },
  ];
  const schedule: Record<string, { dows: number[]; start: string; end: string; breakMin?: number }> = {
    "e-minji": { dows: [1, 2, 3, 4, 5], start: "10:00", end: "14:30", breakMin: 30 },
    "e-seojun": { dows: [0, 6], start: "10:00", end: "18:30", breakMin: 60 },
    "e-haneul": { dows: [2, 4, 6], start: "18:00", end: "22:00" },
  };
  // 근무표: 지난 8주 + 다음 1주. 출퇴근 기록은 근무표를 따르되 지각·결근이 가끔 섞인다.
  const shifts: Shift[] = [];
  const attendance: Attendance[] = [];
  const absentDay = addDays(weekStart(today), -15); // 3주 전 토요일
  let n = 0;
  for (let d = addDays(today, -56); d < addDays(today, 7); d = addDays(d, 1)) {
    for (const [empId, s] of Object.entries(schedule)) {
      if (!s.dows.includes(dayOfWeek(d))) continue;
      shifts.push({ id: `sh-${empId}-${d}`, employeeId: empId, date: d, start: s.start, end: s.end });
      if (d >= today || (empId === "e-seojun" && d === absentDay)) continue;
      n++;
      const late = empId === "e-haneul" && n % 7 === 0;
      const clockIn = late ? `${d}T${s.start.slice(0, 3)}12` : `${d}T${s.start}`;
      attendance.push({ id: `at-${empId}-${d}`, employeeId: empId, clockIn, clockOut: `${d}T${s.end}`, breakMin: s.breakMin });
    }
  }

  const recurring: RecurringExpense[] = [
    { id: "r-rent", name: "임대료", amount: 1_800_000 },
    { id: "r-maint", name: "관리비", amount: 250_000 },
    { id: "r-pos", name: "통신·POS 이용료", amount: 80_000 },
    { id: "r-ins", name: "화재·영업배상 보험", amount: 60_000 },
    { id: "r-dep", name: "감가상각(머신·인테리어)", amount: 300_000 },
  ];
  const expenses: Expense[] = [];
  for (const m of [addMonths(today.slice(0, 7), -2), addMonths(today.slice(0, 7), -1), today.slice(0, 7)]) {
    expenses.push(
      { id: `x-${m}-elec`, month: m, category: "variable", name: "전기", amount: 350_000 },
      { id: `x-${m}-gas`, month: m, category: "variable", name: "가스·수도", amount: 70_000 },
      { id: `x-${m}-supply`, month: m, category: "variable", name: "소모품(행주·세제 등)", amount: 150_000 },
      { id: `x-${m}-mkt`, month: m, category: "variable", name: "마케팅(배민 광고)", amount: 100_000 },
    );
  }

  const r = (id: string, daysAgo: number, platform: Review["platform"], rating: number, author: string, text: string): Review => ({
    id,
    platform,
    rating,
    author,
    text,
    createdAt: addDays(today, -daysAgo),
    sentiment: "neutral",
    menuIds: [],
    keywords: [],
    status: "pending",
  });
  const reviews: Review[] = [
    r("rv-1", 1, "baemin", 5, "커피러버", "바닐라라떼 진짜 맛있어요! 시럽을 직접 만드신다더니 향이 달라요. 포장도 꼼꼼해서 하나도 안 샜어요. 재주문 할게요~"),
    r("rv-2", 1, "naver", 5, "망원동주민", "분위기 아늑하고 사장님 너무 친절하세요. 아아 고소하고 진해서 좋아요"),
    r("rv-3", 2, "baemin", 2, "jh***", "얼그레이 파운드 너무 퍽퍽하고 맛이 별로였어요. 가격 대비 아쉽네요"),
    r("rv-4", 3, "coupang", 3, "익명", "아이스 아메리카노 뚜껑이 제대로 안 닫혀서 흘러 있었어요. 맛은 괜찮았어요"),
    r("rv-5", 4, "naver", 4, "단골손님", "흑임자 라떼 처음 먹어봤는데 고소하고 맛있네요. 왜 이제 알았지"),
    r("rv-6", 5, "baemin", 1, "ㅇㅇ", "얼그레이 파운드 맛없어요. 다시는 안 시킬듯"),
    r("rv-7", 6, "baemin", 5, "치즈케이크덕후", "뉴욕 치즈케이크 꾸덕하고 진해요 존맛. 배달도 빨리 왔어요"),
    r("rv-8", 8, "naver", 5, "카공족", "조용하고 콘센트 많아서 공부하기 좋아요. 카페라떼 부드러워요"),
  ];

  // 재료 매입: 매주 월요일, 지난주 판매 기준 이론 사용량에 재료별 여유분(로스)을 더해 포장 단위로 구매
  const menuMap = new Map(menus.map((m) => [m.id, m]));
  const extra: Record<string, number> = { "i-milk": 0.12, "i-bean": 0.06, "i-cream": 0.25, "i-strawberry": 0.3, "i-ice": 0 };
  const PACKAGING = new Set(["i-cup-ice", "i-cup-hot", "i-lid", "i-straw", "i-box"]);
  const purchases: Purchase[] = [];
  for (let ws = weekStart(addDays(today, -56)); ws <= today; ws = addDays(ws, 7)) {
    const used = theoreticalUsage(sales.filter((l) => l.date >= addDays(ws, -7) && l.date < ws), menuMap);
    const items = ingredients
      .filter((i) => i.id !== "i-ice" && (used.get(i.id) ?? 0) > 0)
      .map((i) => {
        // 포장재·소모품은 쓰는 만큼 채우고(재고 이월), 식재료는 여유분(로스)까지 포장 단위로 올려 산다
        const need = ((used.get(i.id) ?? 0) * (1 + (PACKAGING.has(i.id) ? 0 : (extra[i.id] ?? 0.03)))) / i.packSize;
        return { ingredientId: i.id, packs: Math.max(1, PACKAGING.has(i.id) ? Math.round(need) : Math.ceil(need)), packPrice: i.packPrice };
      });
    if (items.length && used.size) purchases.push({ id: `pu-${ws}`, date: ws, items, memo: "주간 정기 매입" });
  }

  const dayNotes: DayNote[] = [
    { id: addDays(today, -3), date: addDays(today, -3), weather: "rain", memo: "오후 내내 비" },
    { id: addDays(today, -10), date: addDays(today, -10), weather: "sunny", memo: "근처 공원 행사" },
    { id: addDays(today, -20), date: addDays(today, -20), weather: "cloudy" },
  ];

  return { ingredients, menus, sales, employees, attendance, recurring, expenses, reviews, shifts, purchases, dayNotes };
}

export function priceHistorySeed(ingredients: Ingredient[], today: string) {
  // 원두·우유는 최근 두 달 사이 단가가 올랐다는 이력을 남겨 둔다
  const rows = [];
  for (const i of ingredients) {
    if (i.id === "i-bean") rows.push({ ingredientId: i.id, packPrice: 25000, date: addDays(today, -60) });
    if (i.id === "i-milk") rows.push({ ingredientId: i.id, packPrice: 2500, date: addDays(today, -45) });
    rows.push({ ingredientId: i.id, packPrice: i.packPrice, date: today });
  }
  return rows;
}
