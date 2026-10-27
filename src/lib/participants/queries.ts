import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { events, participants } from "@/lib/db/schema";
import { now as serverNow } from "@/lib/time";
import type { EventSummary } from "@/lib/events/queries";

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

export type ParticipantContext = {
  event: EventSummary;
  participant: Participant | null;
};

export type LoadOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

const eventColumns = {
  id: events.id,
  title: events.title,
  status: events.status,
  durationMinutes: events.durationMinutes,
  code: events.code,
  startsAt: events.startsAt,
  deadlineAt: events.deadlineAt,
};

const participantColumns = {
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

type ParticipantRow = {
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
function toParticipant(row: ParticipantRow): Participant {
  return {
    ...row,
    status: row.status as ParticipantStatus,
    lockoutReason: row.lockoutReason as LockoutReason | null,
  };
}

/**
 * Lockout is reconciled, never scheduled: the first read at or past the
 * deadline locks the participant at the deadline itself, not at the moment we
 * noticed. `locked_at = deadline_at` is what makes a late refresh honest.
 */
async function reconcileDeadline(
  participant: Participant,
  event: EventSummary,
  at: Date,
): Promise<Participant> {
  if (participant.status === "locked_out" || !event.deadlineAt) {
    return participant;
  }
  if (at.getTime() < event.deadlineAt.getTime()) {
    return participant;
  }

  const [locked] = await getDb()
    .update(participants)
    .set({
      status: "locked_out",
      lockoutReason: "deadline",
      lockedAt: event.deadlineAt,
    })
    .where(
      and(
        eq(participants.id, participant.id),
        ne(participants.status, "locked_out"),
      ),
    )
    .returning(participantColumns);

  if (locked) return toParticipant(locked);

  // A concurrent read locked them first; return whatever won.
  const [current] = await getDb()
    .select(participantColumns)
    .from(participants)
    .where(eq(participants.id, participant.id))
    .limit(1);
  return current ? toParticipant(current) : participant;
}

/**
 * The one way a participant page reads its own row: resolve the Join Code,
 * join the participant in the same query, and reconcile the deadline.
 *
 * Returns null when no event carries the code. `participant` is null when the
 * viewer has not joined this event. Ended codes may be reused, so a row that
 * already belongs to this user wins over the newest match.
 */
export async function loadParticipantContext(
  code: string,
  userId: string,
  options: LoadOptions = {},
): Promise<ParticipantContext | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const rows = await getDb()
    .select({ event: eventColumns, participant: participantColumns })
    .from(events)
    .leftJoin(
      participants,
      and(
        eq(participants.eventId, events.id),
        eq(participants.userId, userId),
      ),
    )
    .where(eq(events.code, normalized))
    .orderBy(desc(events.createdAt));

  const chosen =
    rows.find((row) => row.participant?.id != null) ??
    rows.find((row) => row.event.status !== "ended") ??
    rows[0];
  if (!chosen) return null;

  if (!chosen.participant?.id) {
    return { event: chosen.event, participant: null };
  }

  const participant = await reconcileDeadline(
    toParticipant(chosen.participant as ParticipantRow),
    chosen.event,
    options.now ?? serverNow(),
  );

  return { event: chosen.event, participant };
}
