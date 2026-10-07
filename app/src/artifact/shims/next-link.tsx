// 아티팩트 빌드에서 next/link 대신 쓰는 해시 링크. "/menu" → "#menu", "/poster?menu=x" → "#poster" + 메모리 파라미터.
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { setRouteParam } from "@/lib/platform";

export function routeToken(path: string) {
  return path === "/" || path === "" ? "home" : path.replace(/^\//, "");
}

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode };

export default function Link({ href, onClick, children, ...rest }: Props) {
  const [path, query] = href.split("?");
  return (
    <a
      {...rest}
      href={"#" + routeToken(path)}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (query) for (const [k, v] of new URLSearchParams(query)) setRouteParam(k, v);
      }}
    >
      {children}
    </a>
  );
}
