import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { sqlOne, sql } from "./db";
import { verifyPin } from "./pin";

export { hashPin, verifyPin } from "./pin";

const COOKIE = "juju_session";
const MAX_FAILS = 5;
const LOCK_MINUTES = 10;

export type Role = "child" | "parent";

export type SessionUser = {
  id: number;
  slug: string;
  displayName: string;
  role: Role;
  uiSize: "md" | "lg";
  themeColor: string;
  emoji: string;
};

/* ---------- 세션 쿠키 ---------- */

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET 이 없거나 너무 짧습니다(32자 이상).");
  }
  return new TextEncoder().encode(s);
}

export async function issueSession(user: SessionUser) {
  const token = await new SignJWT({
    sub: String(user.id),
    slug: user.slug,
    name: user.displayName,
    role: user.role,
    size: user.uiSize,
    color: user.themeColor,
    emoji: user.emoji,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function readSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: Number(payload.sub),
      slug: String(payload.slug),
      displayName: String(payload.name),
      role: payload.role as Role,
      uiSize: (payload.size as "md" | "lg") ?? "md",
      themeColor: String(payload.color ?? "blue"),
      emoji: String(payload.emoji ?? "🙂"),
    } satisfies SessionUser;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;

/* ---------- 로그인 (5회 실패 → 10분 잠금) ---------- */

type UserRow = {
  id: number;
  slug: string;
  display_name: string;
  role: Role;
  pin_hash: string | null;
  ui_size: "md" | "lg";
  theme_color: string;
  emoji: string;
  failed_logins: number;
  locked_until: Date | null;
};

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "no_user" | "bad_pin" | "locked"; minutesLeft?: number };

export async function login(slug: string, pin: string): Promise<LoginResult> {
  const row = await sqlOne<UserRow>`
    SELECT id, slug, display_name, role, pin_hash, ui_size, theme_color, emoji,
           failed_logins, locked_until
      FROM users WHERE slug = ${slug}`;
  if (!row) return { ok: false, reason: "no_user" };

  if (row.locked_until && row.locked_until.getTime() > Date.now()) {
    const minutesLeft = Math.ceil(
      (row.locked_until.getTime() - Date.now()) / 60000
    );
    return { ok: false, reason: "locked", minutesLeft };
  }

  if (!verifyPin(pin, row.pin_hash)) {
    const fails = row.failed_logins + 1;
    if (fails >= MAX_FAILS) {
      await sql`UPDATE users
                   SET failed_logins = 0,
                       locked_until = now() + (${LOCK_MINUTES} || ' minutes')::interval
                 WHERE id = ${row.id}`;
      return { ok: false, reason: "locked", minutesLeft: LOCK_MINUTES };
    }
    await sql`UPDATE users SET failed_logins = ${fails} WHERE id = ${row.id}`;
    return { ok: false, reason: "bad_pin" };
  }

  await sql`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ${row.id}`;
  const user: SessionUser = {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    role: row.role,
    uiSize: row.ui_size,
    themeColor: row.theme_color,
    emoji: row.emoji,
  };
  return { ok: true, user };
}
