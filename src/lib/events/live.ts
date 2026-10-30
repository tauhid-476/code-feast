import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import {
  countParticipants,
  lockAtDeadline,
  participantColumns,
  toParticipant,
  type Participant,
  type ParticipantCounts,
} from "@/lib/participants/lockout";
import { getReadyCount } from "@/lib/runner/pool";
import { now as serverNow, secondsBetween } from "@/lib/time";
import { getOrganizerEvent, type EventSummary } from "./queries";

/** SPEC §4.4: the health strip's numbers, all from the database. */
export type EventHealth = ParticipantCounts & {
  readySandboxes: number;
  /** Null while the event has no deadline; 0 once it is reached. */
  secondsRemaining: number | null;
};

export type LiveView = {
  event: EventSummary;
  health: EventHealth;
  eliminated: Participant[];
};

export type LiveOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

/**
 * Everything the Organizer's live view shows. This reads Participants, so it
 * reconciles the Deadline first (ADR 0002): a roster that has not been looked
 * at since the deadline is locked at the deadline, not at the moment the
 * organizer opened the page. The count is then read in the same transaction as
 * the lock, so the strip cannot show a half-reconciled event.
 */
export async function getEventHealth(
  organizerId: string,
  eventId: string,
  options: LiveOptions = {},
): Promise<LiveView | null> {
  const event = await getOrganizerEvent(organizerId, eventId);
  if (!event) return null;

  const at = options.now ?? serverNow();

  const { counts, eliminated } = await getDb().transaction(async (tx) => {
    if (event.deadlineAt && at.getTime() >= event.deadlineAt.getTime()) {
      await lockAtDeadline(tx, { eventId: event.id }, event.deadlineAt);
    }
    const counts = await countParticipants(event.id, tx);
    const eliminatedRows = await tx
      .select(participantColumns)
      .from(participants)
      .where(
        and(
          eq(participants.eventId, event.id),
          eq(participants.status, "locked_out"),
          eq(participants.lockoutReason, "eliminated"),
        ),
      )
      .orderBy(desc(participants.lockedAt));

    return {
      counts,
      eliminated: eliminatedRows.map(toParticipant),
    };
  });

  const readySandboxes = await getReadyCount();

  return {
    event,
    health: {
      ...counts,
      readySandboxes,
      secondsRemaining: event.deadlineAt
        ? secondsBetween(at, event.deadlineAt)
        : null,
    },
    eliminated,
  };
}
