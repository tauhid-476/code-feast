import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { getDb, getPool } from "@/lib/db/client";

export const db = getDb();

const TABLES = [
  "violations",
  "submission_snippets",
  "submissions",
  "drafts",
  "participants",
  "test_cases",
  "problem_starters",
  "problems",
  "runner_pool",
  "events",
  "approved_organizers",
] as const;

export async function resetDatabase(): Promise<void> {
  await db.execute(
    sql.raw(`truncate table ${TABLES.join(", ")} restart identity cascade`),
  );
}

/**
 * Call once at the top of a test file: wipes the database before every test and
 * closes the pool afterwards so Vitest can exit.
 */
export function useCleanDatabase(): void {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await getPool().end();
  });
}
