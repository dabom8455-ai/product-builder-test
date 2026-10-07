// 아티팩트 빌드에서 next/link 대신 쓰는 내부 이동 링크.
// href 를 두지 않는다: 뷰어가 링크 클릭을 가로채지 못하게 하고, 이동은 앱 상태로만 처리한다.
import type { AnchorHTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { setRouteParam } from "@/lib/platform";
import { navigate } from "../router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; children?: ReactNode };

export default function Link({ href, onClick, children, className, ...rest }: Props) {
  const [path, query] = href.split("?");
  const go = () => {
    if (query) for (const [k, v] of new URLSearchParams(query)) setRouteParam(k, v);
    navigate(path || "/");
  };
  return (
    <a
      {...rest}
      role="link"
      tabIndex={0}
      className={`cursor-pointer ${className ?? ""}`}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        onClick?.(e);
        go();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLAnchorElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
    >
      {children}
    </a>
  );
}
