// 아티팩트 빌드에서 next/navigation 대신: 현재 경로는 앱 안의 라우터 상태에서 읽는다.
import { useRoute } from "../router";

export function usePathname() {
  return useRoute((s) => s.path);
}
