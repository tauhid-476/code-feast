import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb, type Executor } from "@/lib/db/client";
import {
  drafts,
  participants,
  submissionSnippets,
  submissions,
} from "@/lib/db/schema";

/** The Participant vocabulary lives here so every read and write agrees. */
export type ParticipantStatus = "joined" | "solving" | "locked_out";
export type LockoutReason = "submitted" | "deadline" | "eliminated";

export type Participant = {
  id: string;
  eventId: string;
  userId: string;
  displayName: string;
  email: string;
  status: ParticipantStatus;
  joinedAt: Date;
  lockedAt: Date | null;
  lockoutReason: LockoutReason | null;
  strikes: number;
  shortlisted: boolean;
};

export const participantColumns = {
  id: participants.id,
  eventId: participants.eventId,
  userId: participants.userId,
  displayName: participants.displayName,
  email: participants.email,
  status: participants.status,
  joinedAt: participants.joinedAt,
  lockedAt: participants.lockedAt,
  lockoutReason: participants.lockoutReason,
  strikes: participants.strikes,
  shortlisted: participants.shortlisted,
};

export type ParticipantRow = {
  id: string;
  eventId: string;
  userId: string;
  displayName: string;
  email: string;
  status: string;
  joinedAt: Date;
  lockedAt: Date | null;
  lockoutReason: string | null;
  strikes: number;
  shortlisted: boolean;
};

/** The check constraints are the source of truth; the casts narrow to them. */
export function toParticipant(row: ParticipantRow): Participant {
  return {
    ...row,
    status: row.status as ParticipantStatus,
    lockoutReason: row.lockoutReason as LockoutReason | null,
  };
}

export type LockScope = { participantId: string } | { eventId: string };

export type FinalizeLockoutInput = {
  reason: LockoutReason;
  lockedAt: Date;
};

/**
 * Freezes the Participant's work as one Submission: the last autosaved code of
 * every Problem, in the language they last used for it. A Submission is unique
 * per Participant, so a second call is a no-op rather than a second record.
 *
 * Only drafts exist here. The Harness lives in `problem_starters` and is never
 * copied into a draft, which is what keeps a Submission free of it.
 */
async function recordSubmission(
  executor: Executor,
  participantId: string,
  input: FinalizeLockoutInput,
): Promise<void> {
  const [submission] = await executor
    .insert(submissions)
    .values({
      participantId,
      lockedAt: input.lockedAt,
      reason: input.reason,
    })
    // A participant who was reinstated and locked again gets one Submission,
    // rewritten for the new lockout rather than a second row.
    .onConflictDoUpdate({
      target: submissions.participantId,
      set: { lockedAt: input.lockedAt, reason: input.reason },
    })
    .returning({ id: submissions.id });

  // Snippets are replaced so a reopened contest never shows the previous
  // lockout's code.
  await executor
    .delete(submissionSnippets)
    .where(eq(submissionSnippets.submissionId, submission.id));

  const latest = await executor
    .selectDistinctOn([drafts.problemId], {
      problemId: drafts.problemId,
      language: drafts.language,
      code: drafts.code,
    })
    .from(drafts)
    .where(eq(drafts.participantId, participantId))
    .orderBy(
      drafts.problemId,
      desc(drafts.updatedAt),
      // A same-millisecond tie must not make the snapshot depend on row order.
      drafts.language,
    );

  if (latest.length === 0) return;

  await executor.insert(submissionSnippets).values(
    latest.map((snippet) => ({
      submissionId: submission.id,
      problemId: snippet.problemId,
      language: snippet.language,
      code: snippet.code,
    })),
  );
}

/**
 * The one lockout write. Conditional on the Participant not already being
 * locked, which makes concurrent readers safe and preserves a `submitted` or
 * `eliminated` reason. Returning null means someone else won the race.
 *
 * The Submission is written by the same executor, so a caller that passes an
 * open transaction gets the lock and the frozen code atomically.
 */
export async function finalizeLockout(
  executor: Executor,
  participantId: string,
  input: FinalizeLockoutInput,
): Promise<Participant | null> {
  const [row] = await executor
    .update(participants)
    .set({
      status: "locked_out",
      lockoutReason: input.reason,
      lockedAt: input.lockedAt,
    })
    .where(
      and(
        eq(participants.id, participantId),
        ne(participants.status, "locked_out"),
      ),
    )
    .returning(participantColumns);

  if (!row) return null;

  await recordSubmission(executor, participantId, input);
  return toParticipant(row);
}

/**
 * The deadline-lockout write, shared by the read-path reconciliation, the bulk
 * reconciliation in the live health strip, and End now. `locked_at` is the
 * deadline itself, never the moment the server noticed, so a laptop that was
 * closed at minute 88 still has an honest lockout time (ADR 0002).
 *
 * The write is conditional on the participant not already being locked, which
 * is what makes concurrent reads safe and preserves a `submitted` or
 * `eliminated` reason. Each participant locked here also gets the Submission
 * their drafts add up to, in the same transaction when the caller has one.
 */
export async function lockAtDeadline(
  executor: Executor,
  scope: LockScope,
  deadlineAt: Date,
): Promise<Participant[]> {
  const target =
    "participantId" in scope
      ? eq(participants.id, scope.participantId)
      : eq(participants.eventId, scope.eventId);

  const rows = await executor
    .update(participants)
    .set({
      status: "locked_out",
      lockoutReason: "deadline",
      lockedAt: deadlineAt,
    })
    .where(and(target, ne(participants.status, "locked_out")))
    .returning(participantColumns);

  for (const row of rows) {
    await recordSubmission(executor, row.id, {
      reason: "deadline",
      lockedAt: deadlineAt,
    });
  }

  return rows.map(toParticipant);
}

/**
 * Entering the contest is what makes a participant "solving"; Start
 * deliberately does not mark the roster on their behalf (ticket 08). The write
 * is conditional on `joined`, so entering twice is harmless and a locked
 * participant is never reopened by a stale tab.
 */
export async function markSolving(
  participantId: string,
  at: Date,
  executor: Executor = getDb(),
): Promise<Participant | null> {
  const [row] = await executor
    .update(participants)
    .set({ status: "solving", lastSeenAt: at })
    .where(and(eq(participants.id, participantId), eq(participants.status, "joined")))
    .returning(participantColumns);

  return row ? toParticipant(row) : null;
}

export type ParticipantCounts = {
  /** Everyone who joined, whatever their status. */
  participants: number;
  solving: number;
  locked: number;
};

/** One grouped count, so the health strip cannot drift from the statuses. */
export async function countParticipants(
  eventId: string,
  executor: Executor = getDb(),
): Promise<ParticipantCounts> {
  const rows = await executor
    .select({
      status: participants.status,
      count: sql<number>`count(*)::int`,
    })
    .from(participants)
    .where(eq(participants.eventId, eventId))
    .groupBy(participants.status);

  const counts: ParticipantCounts = { participants: 0, solving: 0, locked: 0 };
  for (const row of rows) {
    const count = Number(row.count);
    counts.participants += count;
    if (row.status === "solving") counts.solving = count;
    if (row.status === "locked_out") counts.locked = count;
  }
  return counts;
}
