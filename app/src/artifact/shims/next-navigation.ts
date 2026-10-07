// 아티팩트 빌드에서 next/navigation 대신: 현재 경로를 location.hash 에서 읽는다.
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function currentPath() {
  const token = window.location.hash.replace(/^#/, "");
  return !token || token === "home" ? "/" : "/" + token;
}

export function usePathname() {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}
