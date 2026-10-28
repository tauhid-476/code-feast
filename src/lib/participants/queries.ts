import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { events, participants } from "@/lib/db/schema";
import { now as serverNow } from "@/lib/time";
import type { EventSummary } from "@/lib/events/queries";
import {
  lockAtDeadline,
  participantColumns,
  toParticipant,
  type Participant,
  type ParticipantRow,
} from "./lockout";

export type {
  LockoutReason,
  Participant,
  ParticipantStatus,
} from "./lockout";

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

  const [locked] = await lockAtDeadline(
    getDb(),
    { participantId: participant.id },
    event.deadlineAt,
  );
  if (locked) return locked;

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
