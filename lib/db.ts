import { Pool } from "pg";

/**
 * 로컬(Docker/system Postgres)과 Vercel(Neon) 양쪽에서 동작해야 하므로
 * Neon 전용 드라이버 대신 표준 `pg` 를 쓴다. Neon 은 pooled 연결 문자열로 접속한다.
 */
function connString(): string {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
}

function isLocalUrl(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

declare global {
  // eslint-disable-next-line no-var
  var __jujuPool: Pool | undefined;
}

function getPool(): Pool {
  // 환경변수는 모듈 평가 시점이 아니라 첫 질의 시점에 읽는다.
  // (스크립트에서 dotenv 를 import 뒤에 호출해도 동작해야 한다)
  const connectionString = connString();
  if (!connectionString) {
    throw new Error(
      "DB 연결 문자열이 없습니다. .env.local 에 POSTGRES_URL 을 설정하세요."
    );
  }
  if (!globalThis.__jujuPool) {
    globalThis.__jujuPool = new Pool({
      connectionString,
      ssl: isLocalUrl(connectionString) ? undefined : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalThis.__jujuPool;
}

/**
 * 파라미터 바인딩 태그드 템플릿.
 *   await sql<Row>`SELECT * FROM users WHERE id = ${id}`
 * 값은 전부 $1, $2 … 로 바인딩되므로 SQL 인젝션이 생기지 않는다.
 */
export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const text = strings.reduce(
    (acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""),
    ""
  );
  const res = await getPool().query(text, values);
  return res.rows as T[];
}

/** 한 행만 필요할 때 */
export async function sqlOne<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T | null> {
  const rows = await sql<T>(strings, ...values);
  return rows[0] ?? null;
}

/** 스키마/시드 스크립트용 — 임의 SQL 실행 */
export async function raw(text: string, values: unknown[] = []) {
  return getPool().query(text, values);
}

export async function closePool() {
  if (globalThis.__jujuPool) {
    await globalThis.__jujuPool.end();
    globalThis.__jujuPool = undefined;
  }
}
