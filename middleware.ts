import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "juju_session";
const PUBLIC = ["/login", "/manifest.webmanifest", "/robots.txt", "/icon.svg"];

/**
 * 미들웨어는 Edge 런타임이라 pg 를 쓸 수 없다. 쿠키 서명만 검증한다.
 * (lib/auth.ts 는 next/headers·pg 를 쓰므로 여기서 import 하지 않는다)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  let role: string | null = null;

  if (token && secret && secret.length >= 32) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
      role = String(payload.role ?? "");
    } catch {
      role = null;
    }
  }

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/parent") && role !== "parent") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
