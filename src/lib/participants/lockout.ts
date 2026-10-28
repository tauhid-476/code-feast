import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, type Executor } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";

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

/**
 * The one deadline-lockout write, shared by the read-path reconciliation, the
 * bulk reconciliation in the live health strip, and End now. `locked_at` is the
 * deadline itself, never the moment the server noticed, so a laptop that was
 * closed at minute 88 still has an honest lockout time (ADR 0002).
 *
 * The write is conditional on the participant not already being locked, which
 * is what makes concurrent reads safe and preserves a `submitted` or
 * `eliminated` reason.
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

  return rows.map(toParticipant);
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
