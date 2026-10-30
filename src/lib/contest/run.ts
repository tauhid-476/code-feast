import { and, eq, isNull, lt, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants, problems } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import type { ParticipantContext } from "@/lib/participants/queries";
import { requireActiveSession } from "@/lib/participants/session";
import {
  runAgainstSamples,
  type RunOptions,
  type RunResult,
} from "@/lib/runner/run";
import { now as serverNow } from "@/lib/time";

/**
 * A Participant's Run (SPEC §5.6): their current editor content plus the hidden
 * Harness, compiled and executed against this Problem's two Sample Test Cases.
 *
 * It is feedback only. Nothing here writes a submission, changes a strike, or
 * touches the Deadline; the clock keeps running however the Run ends. The
 * participant arrives through the loader, so a Run after the deadline is
 * refused by the same reconciliation every other participant read uses.
 */

export type ContestRunInput = {
  problemId: string;
  language: string;
  /** The editor's current content, without the Harness. */
  code: string;
};

/** SPEC §7: at most one Run in flight, and at least two seconds between Runs. */
export const RUN_MIN_INTERVAL_MS = 2_000;

export type ContestRunOptions = RunOptions & {
  /**
   * The tab running. A displaced tab may not Run (ticket 14); a Run writes
   * nothing, so the loaded row is enough here.
   */
  sessionId?: string | null;
};

/**
 * A claim left behind by a request that died (a deploy, a killed function) must
 * not close Runs for the participant for the rest of the event. No real Run can
 * outlast this: claiming waits 20s at most, compile 15s, and the two samples
 * 6s each.
 */
export const RUN_CLAIM_STALE_MS = 120_000;

/**
 * The limit lives in Postgres, not in this process: several serverless
 * instances serve the same event, and an in-memory flag would let each of them
 * hold one Run for the same participant.
 *
 * One conditional UPDATE both checks and takes the slot, so two concurrent
 * requests cannot both win.
 */
async function claimRunSlot(participantId: string, at: Date): Promise<void> {
  const staleBefore = new Date(at.getTime() - RUN_CLAIM_STALE_MS);
  const intervalBefore = new Date(at.getTime() - RUN_MIN_INTERVAL_MS);

  const [claimed] = await getDb()
    .update(participants)
    .set({ runInFlightAt: at })
    .where(
      and(
        eq(participants.id, participantId),
        or(
          isNull(participants.runInFlightAt),
          lt(participants.runInFlightAt, staleBefore),
        ),
        or(
          isNull(participants.lastRunAt),
          lte(participants.lastRunAt, intervalBefore),
        ),
      ),
    )
    .returning({ id: participants.id });

  if (claimed) return;

  // The UPDATE is the source of truth; a second read only names the refusal.
  const [row] = await getDb()
    .select({
      runInFlightAt: participants.runInFlightAt,
      lastRunAt: participants.lastRunAt,
    })
    .from(participants)
    .where(eq(participants.id, participantId));

  if (row?.runInFlightAt && row.runInFlightAt > staleBefore) {
    throw new DomainError(
      "run_in_flight",
      "Your previous Run is still going. Wait for it to finish.",
      429,
    );
  }

  throw new DomainError(
    "run_too_soon",
    "Runs are limited to one every two seconds.",
    429,
  );
}

/**
 * Gives the slot back and starts the two-second interval. The write is matched
 * on the claim it took, so an expired claim that another request has already
 * reused is not cleared by this one returning late.
 */
async function releaseRunSlot(
  participantId: string,
  claimedAt: Date,
  finishedAt: Date,
): Promise<void> {
  await getDb()
    .update(participants)
    .set({ runInFlightAt: null, lastRunAt: finishedAt })
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.runInFlightAt, claimedAt),
      ),
    );
}

export async function runFromContest(
  context: ParticipantContext | null,
  input: ContestRunInput,
  options: ContestRunOptions = {},
): Promise<RunResult> {
  if (!context?.participant) {
    throw new DomainError(
      "not_joined",
      "Join this event before running code.",
      403,
    );
  }
  if (context.participant.status === "locked_out") {
    throw new DomainError(
      "contest_locked",
      "Your contest is locked. Runs are closed.",
      409,
    );
  }
  if (context.event.status !== "live") {
    throw new DomainError(
      "contest_not_open",
      "This event is not live. Runs open when the organizer starts it.",
      409,
    );
  }
  requireActiveSession(context.participant, options.sessionId ?? null);

  // A Problem from another event must look like one that does not exist.
  const [problem] = await getDb()
    .select({ id: problems.id })
    .from(problems)
    .where(
      and(
        eq(problems.id, input.problemId),
        eq(problems.eventId, context.event.id),
      ),
    )
    .limit(1);
  if (!problem) {
    throw new DomainError(
      "problem_not_found",
      "That problem is not part of this event.",
      404,
    );
  }

  // `now` is frozen for the whole call, so a test that moves the clock sees the
  // same instant at claim and release; the app uses the real clock twice.
  const claimedAt = options.now ?? serverNow();
  await claimRunSlot(context.participant.id, claimedAt);

  try {
    return await runAgainstSamples(
      {
        problemId: problem.id,
        language: input.language,
        code: input.code,
      },
      { ...options, eventId: context.event.id },
    );
  } finally {
    try {
      await releaseRunSlot(
        context.participant.id,
        claimedAt,
        options.now ?? serverNow(),
      );
    } catch (error) {
      // A stuck claim expires after RUN_CLAIM_STALE_MS; it must not turn a real
      // Run result into an error.
      console.error("[runner] could not release the run slot", error);
    }
  }
}
