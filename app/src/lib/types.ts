// 앱 전역 데이터 모델. docs/PLAN.md §3 의 엔티티를 클라이언트 저장소용으로 단순화했다.

export type Channel = "hall" | "baemin" | "coupang" | "yogiyo" | "naver";

export const CHANNELS: { id: Channel; label: string; delivery: boolean }[] = [
  { id: "hall", label: "홀/포장", delivery: false },
  { id: "baemin", label: "배민", delivery: true },
  { id: "coupang", label: "쿠팡이츠", delivery: true },
  { id: "yogiyo", label: "요기요", delivery: true },
  { id: "naver", label: "네이버주문", delivery: false },
];

export type Tone = "friendly" | "polite" | "witty";
export type VatMode = "general" | "simplified" | "none";
export type TaxType = "insurance" | "freelance" | "none";

export interface Store {
  name: string;
  tone: Tone;
  brandColor: string;
  /** 상시 근로자 5인 이상 → 연장·야간 가산수당 적용 */
  over5Employees: boolean;
  vatMode: VatMode;
  /** 채널별 중개+결제 수수료율 (0~1) */
  channelFeeRate: Record<Channel, number>;
  /** 배달 1건(메뉴 1개)당 추가 포장재비 */
  deliveryPackagingCost: number;
  targetCostRatio: { drink: number; dessert: number };
  /** 월 매출 목표(원). 0이면 미설정 */
  monthlySalesTarget: number;
  /** 정기 휴무 요일 (0=일 … 6=토) */
  closedDays: number[];
  /** 리뷰 답글 맺음 서명 */
  replySignature: string;
}

export interface LaborRule {
  minWage: number;
  /** 근로자 부담 4대보험 추정 공제율 */
  employeeInsuranceRate: number;
  /** 사업주 부담 4대보험 추정 비율 (손익의 인건비에 가산) */
  employerInsuranceRate: number;
  freelanceTaxRate: number;
}

export interface Ingredient {
  id: string;
  name: string;
  /** 표시 단위: g, ml, 개 */
  unit: string;
  packSize: number;
  packPrice: number;
  updatedAt: string;
}

export interface IngredientPrice {
  ingredientId: string;
  packPrice: number;
  date: string;
}

export type MenuCategory = "drink" | "dessert";

export interface RecipeItem {
  /** 재료 id 또는 서브레시피(메뉴 id, isSub) */
  refId: string;
  kind: "ingredient" | "sub";
  qty: number;
}

export interface Menu {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;
  deliveryPrice: number;
  /** 서브레시피(시럽·베이스 등): 판매 메뉴가 아니며, yieldQty 단위로 생산된다 */
  isSub: boolean;
  yieldQty: number;
  yieldUnit: string;
  recipe: RecipeItem[];
  /** 레시피 로스율 (0~1) */
  lossRate: number;
  active: boolean;
  description?: string;
}

export interface SaleLine {
  id: string;
  date: string; // YYYY-MM-DD
  channel: Channel;
  menuId: string;
  qty: number;
}

export interface Employee {
  id: string;
  name: string;
  hourlyWage: number;
  weeklyContractHours: number;
  taxType: TaxType;
  healthCertExpiry?: string;
  contractSigned: boolean;
  pin: string;
  active: boolean;
}

export interface Attendance {
  id: string;
  employeeId: string;
  clockIn: string; // ISO
  clockOut?: string; // ISO
  /** 명시적 휴게시간(분). 비어 있으면 법정 최소 휴게시간 적용 */
  breakMin?: number;
}

export interface Expense {
  id: string;
  month: string; // YYYY-MM
  category: "fixed" | "variable";
  name: string;
  amount: number;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
}

export type ReviewPlatform = "naver" | "baemin" | "coupang" | "etc";
export type Sentiment = "positive" | "neutral" | "negative";

export interface Review {
  id: string;
  platform: ReviewPlatform;
  rating: number;
  author?: string;
  text: string;
  createdAt: string;
  sentiment: Sentiment;
  menuIds: string[];
  keywords: string[];
  reply?: string;
  /** 답글 초안을 누가 썼나: AI 또는 기본 템플릿 */
  replySource?: "ai" | "template";
  status: "pending" | "drafted" | "posted";
}

export interface MenuActionLog {
  id: string;
  menuId: string;
  action: string;
  appliedAt: string; // YYYY-MM-DD
}

export interface PurchaseItem {
  ingredientId: string;
  /** 구매한 포장 단위 수 (예: 원두 1kg 봉지 3개 → 3) */
  packs: number;
  /** 포장 1개 가격 */
  packPrice: number;
}

/** 재료 매입 영수증 1장 */
export interface Purchase {
  id: string;
  date: string; // YYYY-MM-DD
  items: PurchaseItem[];
  memo?: string;
}

/** 근무 계획 (근무표의 한 칸) */
export interface Shift {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm (start 보다 작으면 다음 날)
}

export type Weather = "sunny" | "cloudy" | "rain" | "snow" | "hot" | "cold";

export const WEATHER: Record<Weather, string> = {
  sunny: "☀️ 맑음",
  cloudy: "☁️ 흐림",
  rain: "🌧️ 비",
  snow: "❄️ 눈",
  hot: "🥵 폭염",
  cold: "🥶 한파",
};

export interface DayNote {
  id: string; // = date
  date: string;
  weather?: Weather;
  memo?: string;
}
