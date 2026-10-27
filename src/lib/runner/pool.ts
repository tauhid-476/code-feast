import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db/client";
import { runnerPool } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { now } from "@/lib/time";
import {
  e2bSandboxProvider,
  type SandboxHandle,
  type SandboxProvider,
} from "@/lib/runner/sandbox";

/**
 * The warm pool from SPEC.md §7. Rows live in `runner_pool`; the database is
 * the queue, so two requests cannot claim the same sandbox.
 */

/** Target number of warm sandboxes for the event. */
export const POOL_TARGET = 20;

/** How long a Run waits for a sandbox before returning 503. */
export const CLAIM_TIMEOUT_MS = 20_000;

const CLAIM_POLL_MS = 100;

/** Arbitrary bigint key; every replenisher in every process uses the same one. */
const REPLENISH_LOCK_KEY = 0x52554e4e; // "RUNN"

export type ReplenishOptions = {
  provider?: SandboxProvider;
  target?: number;
};

async function countActiveSandboxes(): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(runnerPool)
    .where(ne(runnerPool.state, "dead"));
  return row?.count ?? 0;
}

async function createPoolRow(provider: SandboxProvider) {
  const handle = await provider.create();
  try {
    const [row] = await getDb()
      .insert(runnerPool)
      .values({ sandboxId: handle.id })
      .returning();
    return row;
  } catch (error) {
    // The row is the only handle the pool keeps; an uninserted sandbox would
    // otherwise burn quota until its one-hour timeout.
    await handle.kill().catch(() => undefined);
    throw error;
  }
}

/**
 * Tops the pool up to `target` (ready + claimed, excluding dead rows). Returns
 * how many sandboxes it created. Safe to call from several requests at once:
 * an advisory lock makes one caller do the work while the others return 0.
 */
export async function replenishPool({
  provider = e2bSandboxProvider,
  target = POOL_TARGET,
}: ReplenishOptions = {}): Promise<number> {
  const client = await getPool().connect();
  let created = 0;

  try {
    const lock = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1) as locked",
      [REPLENISH_LOCK_KEY],
    );
    if (!lock.rows[0]?.locked) return 0;

    try {
      let active = await countActiveSandboxes();
      while (active < target) {
        await createPoolRow(provider);
        active += 1;
        created += 1;
      }
    } finally {
      await client.query("select pg_advisory_unlock($1)", [
        REPLENISH_LOCK_KEY,
      ]);
    }
  } finally {
    client.release();
  }

  return created;
}

/** Live ready count for the organizer health strip. */
export async function getReadyCount(): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(runnerPool)
    .where(eq(runnerPool.state, "ready"));
  return row?.count ?? 0;
}

export type SandboxClaim = {
  /** `runner_pool.id`, used to release the row. */
  poolId: string;
  sandboxId: string;
  handle: SandboxHandle;
};

export type ClaimOptions = {
  provider?: SandboxProvider;
  timeoutMs?: number;
};

type ClaimedRow = {
  id: string;
  sandbox_id: string;
};

const BUSY_MESSAGE = "The runner is busy, try again in a moment.";

function runnerBusy(): DomainError {
  return new DomainError("runner_busy", BUSY_MESSAGE, 503);
}

/**
 * One row per winner. `SKIP LOCKED` makes a concurrent claim step over the row
 * the other transaction is already claiming, so two Runs never share a
 * sandbox. Raw SQL because Drizzle has no `FOR UPDATE SKIP LOCKED` builder.
 */
async function claimReadyRow(): Promise<ClaimedRow | null> {
  const result = await getDb().execute<ClaimedRow>(sql`
    update runner_pool
    set state = 'claimed', claimed_at = now()
    where id = (
      select id from runner_pool
      where state = 'ready'
      order by created_at
      limit 1
      for update skip locked
    )
    returning id, sandbox_id
  `);
  return result.rows[0] ?? null;
}

async function recordHealthyClaim(poolId: string): Promise<void> {
  await getDb()
    .update(runnerPool)
    .set({ lastHealthAt: now() })
    .where(eq(runnerPool.id, poolId));
}

async function markDead(poolId: string): Promise<void> {
  await getDb()
    .update(runnerPool)
    .set({ state: "dead" })
    .where(eq(runnerPool.id, poolId));
}

/**
 * Claims a ready sandbox and health-checks it by connecting. A dead sandbox is
 * discarded, replaced once, and the claim retried; a second dead sandbox in the
 * same claim is a runner failure. If the pool is empty, polls until `timeoutMs`
 * elapses so a Run waits out a burst instead of failing at the first empty look.
 * Throws a 503 `DomainError` on timeout.
 */
export async function claimSandbox({
  provider = e2bSandboxProvider,
  timeoutMs = CLAIM_TIMEOUT_MS,
}: ClaimOptions = {}): Promise<SandboxClaim> {
  const deadline = Date.now() + timeoutMs;
  let replacedDeadSandbox = false;

  while (true) {
    const row = await claimReadyRow();
    if (row) {
      let handle: SandboxHandle;
      try {
        handle = await provider.connect(row.sandbox_id);
        if (!(await handle.isAlive())) {
          throw new Error(`Sandbox ${row.sandbox_id} is not alive.`);
        }
      } catch {
        await markDead(row.id);
        if (replacedDeadSandbox) throw runnerBusy();

        replacedDeadSandbox = true;
        try {
          await createPoolRow(provider);
        } catch {
          throw runnerBusy();
        }
        continue;
      }

      await recordHealthyClaim(row.id);
      return { poolId: row.id, sandboxId: row.sandbox_id, handle };
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw runnerBusy();
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(CLAIM_POLL_MS, remaining)),
    );
  }
}

/**
 * Returns a sandbox to the pool. It never kills the sandbox: the event reuses
 * the same warm sandboxes for its whole run. A row already marked dead is left
 * alone so a late release cannot resurrect it.
 */
export async function releaseSandbox(claim: SandboxClaim): Promise<void> {
  await getDb()
    .update(runnerPool)
    .set({ state: "ready", claimedAt: null })
    .where(
      and(eq(runnerPool.id, claim.poolId), eq(runnerPool.state, "claimed")),
    );
}

/**
 * Claim, run, release in `finally`. Ticket 06 should use this so an exception
 * in the middle of a Run cannot leak a claim.
 */
export async function withClaimedSandbox<T>(
  options: ClaimOptions,
  run: (claim: SandboxClaim) => Promise<T>,
): Promise<T> {
  const claim = await claimSandbox(options);
  try {
    return await run(claim);
  } finally {
    await releaseSandbox(claim);
  }
}

/**
 * A callback for Next's `after()`: a request that notices the pool is short
 * hands this off instead of making the participant wait.
 */
export function scheduleReplenish(
  options: ReplenishOptions = {},
): () => Promise<void> {
  return async () => {
    try {
      await replenishPool(options);
    } catch (error) {
      console.error("[runner] pool replenish failed", error);
    }
  };
}
