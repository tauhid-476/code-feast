import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb, getPool } from "@/lib/db/client";
import { events, runnerPool } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { now } from "@/lib/time";
import {
  createE2BSandboxProvider,
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
  eventId?: string;
};

/**
 * Resolves the sandbox provider for an event. If the event has a configured
 * BYOK `e2bApiKey`, creates a provider with that key. Otherwise falls back to
 * the platform default `e2bSandboxProvider` (which reads `E2B_API_KEY`).
 */
export async function resolveProviderForEvent(
  eventId?: string,
): Promise<SandboxProvider> {
  if (eventId) {
    const [eventRow] = await getDb()
      .select({ e2bApiKey: events.e2bApiKey })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (eventRow?.e2bApiKey?.trim()) {
      return createE2BSandboxProvider({ apiKey: eventRow.e2bApiKey.trim() });
    }
  }
  return e2bSandboxProvider;
}

async function countActiveSandboxes(eventId?: string): Promise<number> {
  const conditions = [
    ne(runnerPool.state, "dead"),
    sql`${runnerPool.createdAt} > now() - interval '55 minutes'`,
  ];

  if (eventId) {
    conditions.push(eq(runnerPool.eventId, eventId));
  } else {
    conditions.push(isNull(runnerPool.eventId));
  }

  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(runnerPool)
    .where(and(...conditions));
  return row?.count ?? 0;
}

async function createPoolRow(provider: SandboxProvider, eventId?: string) {
  const handle = await provider.create();
  try {
    const [row] = await getDb()
      .insert(runnerPool)
      .values({
        sandboxId: handle.id,
        eventId: eventId ?? null,
      })
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
 * Tops the pool up to `target` (ready + claimed, excluding dead and stale >55m rows).
 * Returns how many sandboxes it created. Safe to call from several requests at once:
 * an advisory lock makes one caller do the work while the others return 0.
 */
export async function replenishPool({
  provider,
  target = POOL_TARGET,
  eventId,
}: ReplenishOptions = {}): Promise<number> {
  const client = await getPool().connect();
  let created = 0;

  try {
    const lock = eventId
      ? await client.query<{ locked: boolean }>(
          "select pg_try_advisory_lock($1, hashtext($2)) as locked",
          [REPLENISH_LOCK_KEY, eventId],
        )
      : await client.query<{ locked: boolean }>(
          "select pg_try_advisory_lock($1) as locked",
          [REPLENISH_LOCK_KEY],
        );

    if (!lock.rows[0]?.locked) return 0;

    try {
      const activeProvider = provider ?? (await resolveProviderForEvent(eventId));
      let active = await countActiveSandboxes(eventId);
      while (active < target) {
        await createPoolRow(activeProvider, eventId);
        active += 1;
        created += 1;
      }
    } finally {
      if (eventId) {
        await client.query("select pg_advisory_unlock($1, hashtext($2))", [
          REPLENISH_LOCK_KEY,
          eventId,
        ]);
      } else {
        await client.query("select pg_advisory_unlock($1)", [REPLENISH_LOCK_KEY]);
      }
    }
  } finally {
    client.release();
  }

  return created;
}

/** Live ready count for the organizer health strip. Excludes stale sandboxes >55m. */
export async function getReadyCount(eventId?: string): Promise<number> {
  const baseConditions = [
    eq(runnerPool.state, "ready"),
    sql`${runnerPool.createdAt} > now() - interval '55 minutes'`,
  ];

  if (eventId) {
    const [eventRow] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(runnerPool)
      .where(and(...baseConditions, eq(runnerPool.eventId, eventId)));

    if (eventRow && eventRow.count > 0) {
      return eventRow.count;
    }

    const [globalRow] = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(runnerPool)
      .where(and(...baseConditions, isNull(runnerPool.eventId)));
    return globalRow?.count ?? 0;
  }

  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(runnerPool)
    .where(and(...baseConditions, isNull(runnerPool.eventId)));
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
  eventId?: string;
};

type ClaimedRow = {
  id: string;
  sandbox_id: string;
};

const BUSY_MESSAGE = "The runner is busy, try again in a moment.";

/**
 * What a claim asks the pool for when it finds nothing ready. One sandbox is
 * enough to serve the claim in front of us; the route layer tops the pool up to
 * `POOL_TARGET` afterwards. Asking for the full target here would make a single
 * organizer test create twenty sandboxes.
 */
const COLD_START_TARGET = 1;

function runnerBusy(): DomainError {
  return new DomainError("runner_busy", BUSY_MESSAGE, 503);
}

/**
 * One row per winner. `SKIP LOCKED` makes a concurrent claim step over the row
 * the other transaction is already claiming, so two Runs never share a
 * sandbox. Raw SQL because Drizzle has no `FOR UPDATE SKIP LOCKED` builder.
 * Filters out stale sandboxes older than 55 minutes.
 */
async function claimReadyRow(eventId?: string): Promise<ClaimedRow | null> {
  if (eventId) {
    const scopedResult = await getDb().execute<ClaimedRow>(sql`
      update runner_pool
      set state = 'claimed', claimed_at = now()
      where id = (
        select id from runner_pool
        where state = 'ready'
          and event_id = ${eventId}::uuid
          and created_at > now() - interval '55 minutes'
        order by created_at
        limit 1
        for update skip locked
      )
      returning id, sandbox_id
    `);
    if (scopedResult.rows[0]) return scopedResult.rows[0];
  }

  const result = await getDb().execute<ClaimedRow>(sql`
    update runner_pool
    set state = 'claimed', claimed_at = now()
    where id = (
      select id from runner_pool
      where state = 'ready'
        and event_id is null
        and created_at > now() - interval '55 minutes'
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
  provider,
  timeoutMs = CLAIM_TIMEOUT_MS,
  eventId,
}: ClaimOptions = {}): Promise<SandboxClaim> {
  const deadline = Date.now() + timeoutMs;
  let replacedDeadSandbox = false;
  let requestedReplenish = false;

  const activeProvider = provider ?? (await resolveProviderForEvent(eventId));

  while (true) {
    const row = await claimReadyRow(eventId);
    if (row) {
      let handle: SandboxHandle;
      try {
        handle = await activeProvider.connect(row.sandbox_id);
        if (!(await handle.isAlive())) {
          throw new Error(`Sandbox ${row.sandbox_id} is not alive.`);
        }
      } catch {
        await markDead(row.id);
        if (replacedDeadSandbox) throw runnerBusy();

        replacedDeadSandbox = true;
        try {
          await createPoolRow(activeProvider, eventId);
        } catch {
          throw runnerBusy();
        }
        continue;
      }

      await recordHealthyClaim(row.id);
      return { poolId: row.id, sandboxId: row.sandbox_id, handle };
    }

    // SPEC §7: replenishment happens on any request that finds the pool short.
    // Waiting alone is not enough — on a cold pool nothing else is filling it,
    // so the claim would always time out and the first Run could never succeed.
    // Not awaited: the loop below keeps polling while the sandbox is created.
    if (!requestedReplenish) {
      requestedReplenish = true;
      void replenishPool({
        provider: activeProvider,
        target: COLD_START_TARGET,
        eventId,
      }).catch((error) => {
        console.error("[runner] cold-start replenish failed", error);
      });
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

/**
 * Kills all active E2B sandboxes for an event and marks their `runner_pool` rows
 * as `dead`. Triggered when an event ends so organizers are not billed for lingering
 * sandboxes.
 */
export async function teardownEventSandboxes(
  eventId: string,
  options: { provider?: SandboxProvider } = {},
): Promise<number> {
  const activeProvider =
    options.provider ?? (await resolveProviderForEvent(eventId));

  const rows = await getDb()
    .select({ id: runnerPool.id, sandboxId: runnerPool.sandboxId })
    .from(runnerPool)
    .where(
      and(eq(runnerPool.eventId, eventId), ne(runnerPool.state, "dead")),
    );

  if (rows.length === 0) return 0;

  await getDb()
    .update(runnerPool)
    .set({ state: "dead" })
    .where(
      and(eq(runnerPool.eventId, eventId), ne(runnerPool.state, "dead")),
    );

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        const handle = await activeProvider.connect(row.sandboxId);
        await handle.kill();
      } catch {
        // Ignored if sandbox was already terminated
      }
    }),
  );

  return rows.length;
}
