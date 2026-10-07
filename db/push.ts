import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { raw, closePool } from "../lib/db.ts";

config({ path: ".env.local" });
config({ path: ".env" });

const here = dirname(fileURLToPath(import.meta.url));
const reset = process.argv.includes("--reset");

const TABLES = [
  "parent_memos", "pass_cards", "injuries", "money_log", "exercise_plan",
  "books", "subjects", "wins", "daily_logs", "task_defs", "users",
];

async function main() {
  if (reset) {
    console.log("⚠️  모든 테이블을 삭제합니다…");
    for (const t of TABLES) await raw(`DROP TABLE IF EXISTS ${t} CASCADE`);
  }
  const schema = readFileSync(join(here, "schema.sql"), "utf8");
  await raw(schema);
  console.log("✅ 스키마 적용 완료");
  await closePool();
}

main().catch((e) => {
  console.error("❌ 스키마 적용 실패:", e.message);
  process.exit(1);
});
