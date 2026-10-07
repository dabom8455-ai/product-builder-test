// 아티팩트용 화면 이동: 주소(#)나 링크에 의존하지 않고 앱 안의 상태로만 이동한다.
// claude.ai 뷰어는 프레임 안의 링크 클릭을 가로채 새 탭으로 열거나 막을 수 있어서, 링크로 이동하면 화면이 비거나 바뀌지 않는다.
import { create } from "zustand";

export const ROUTE_PATHS = ["/", "/menu", "/sales", "/pnl", "/analysis", "/reviews", "/staff", "/poster", "/settings"];

function initialPath(): string {
  try {
    const token = window.location.hash.replace(/^#/, "");
    const path = !token || token === "home" ? "/" : "/" + token;
    return ROUTE_PATHS.includes(path) ? path : "/";
  } catch {
    return "/";
  }
}

export const useRoute = create<{ path: string }>(() => ({ path: initialPath() }));

export function navigate(path: string) {
  const clean = ROUTE_PATHS.includes(path) ? path : "/";
  useRoute.setState({ path: clean });
  try {
    window.scrollTo(0, 0);
  } catch {
    // 스크롤이 막힌 환경은 무시
  }
}
