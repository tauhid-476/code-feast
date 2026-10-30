import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { assertOrganizer, type EventActor } from "@/lib/events/manage";
import { getOrganizerEvent } from "@/lib/events/queries";

export type ShortlistResult = {
  id: string;
  shortlisted: boolean;
};

/**
 * Sets the participant's shortlisted mark. Scoped by event and organizer
 * ownership.
 */
export async function setParticipantShortlist(
  actor: EventActor,
  eventId: string,
  participantId: string,
  shortlisted: boolean,
): Promise<ShortlistResult> {
  await assertOrganizer(actor, "manage shortlist");
  const event = await getOrganizerEvent(actor.id, eventId);
  if (!event) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }

  const [row] = await getDb()
    .update(participants)
    .set({ shortlisted })
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.eventId, eventId),
      ),
    )
    .returning({ id: participants.id, shortlisted: participants.shortlisted });

  if (!row) {
    throw new DomainError(
      "participant_not_found",
      "Participant not found.",
      404,
    );
  }

  return row;
}

/**
 * Toggles the shortlisted mark for a participant.
 */
export async function toggleParticipantShortlist(
  actor: EventActor,
  eventId: string,
  participantId: string,
): Promise<ShortlistResult> {
  await assertOrganizer(actor, "manage shortlist");
  const event = await getOrganizerEvent(actor.id, eventId);
  if (!event) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }

  const [current] = await getDb()
    .select({ shortlisted: participants.shortlisted })
    .from(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.eventId, eventId),
      ),
    )
    .limit(1);

  if (!current) {
    throw new DomainError(
      "participant_not_found",
      "Participant not found.",
      404,
    );
  }

  return setParticipantShortlist(actor, eventId, participantId, !current.shortlisted);
}
