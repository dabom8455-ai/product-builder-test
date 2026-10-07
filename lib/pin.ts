import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * PIN 해시만 분리해 둔다. 시드 스크립트(db/seed.ts)는 Next 런타임 밖에서
 * 실행되므로 `next/headers` 를 import 하는 lib/auth.ts 를 쓸 수 없다.
 */
const SCRYPT_N = 16384;

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(pin, salt, 32, { N: SCRYPT_N, r: 8, p: 1 });
  return `scrypt$${SCRYPT_N}$${salt}$${key.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  if (!Number.isSafeInteger(N) || N <= 0) return false;
  let key: Buffer;
  try {
    key = scryptSync(pin, parts[2], 32, { N, r: 8, p: 1 });
  } catch {
    return false;
  }
  const expected = Buffer.from(parts[3], "hex");
  if (expected.length !== key.length) return false;
  return timingSafeEqual(key, expected);
}
