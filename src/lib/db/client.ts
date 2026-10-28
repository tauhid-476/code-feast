import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

export type Database = NodePgDatabase<typeof schema>;

/** The handle an open transaction hands to its callback. */
export type Transaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

/** A database handle or an open transaction; both run the same queries. */
export type Executor = Pick<Database, "select" | "update" | "execute">;

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: Database;
};

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Run `neon env pull`.");
  }
  return url;
}

/**
 * One pool per process. Next.js dev reloads modules, so the pool is cached on
 * globalThis to avoid leaking connections on every hot reload.
 */
export function getPool(): Pool {
  if (!globalForDb.pool) {
    globalForDb.pool = new Pool({
      connectionString: connectionString(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb.pool;
}

export function getDb(): Database {
  if (!globalForDb.db) {
    globalForDb.db = drizzle(getPool(), { schema });
  }
  return globalForDb.db;
}
