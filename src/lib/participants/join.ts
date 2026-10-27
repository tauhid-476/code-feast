import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { isOrganizerEmail } from "@/lib/env";
import { findEndedEventByJoinCode, findEventByJoinCode } from "@/lib/events/queries";

export type JoinEventStatus = "draft" | "live";

export type JoinResult = {
  eventCode: string;
  eventStatus: JoinEventStatus;
  participantId: string;
};

export type JoinInput = {
  userId: string;
  displayName: string;
  email: string;
  code: string;
};

/**
 * Entry by Join Code. A participant gets exactly one row per event: re-entering
 * the code returns the row they already have, it never creates a second one.
 */
export async function joinEventByCode(input: JoinInput): Promise<JoinResult> {
  if (isOrganizerEmail(input.email)) {
    throw new DomainError(
      "organizer_cannot_join",
      "Organizers cannot join an event, including one they created. Sign in with a participant account to compete.",
      403,
    );
  }

  const code = input.code.trim().toUpperCase();
  if (!code) {
    throw new DomainError(
      "join_code_required",
      "Enter the join code your organizer shared.",
    );
  }

  const event = await findEventByJoinCode(code);
  if (!event) {
    const ended = await findEndedEventByJoinCode(code);
    if (ended) {
      throw new DomainError(
        "join_code_ended",
        "This event has already ended. Ask your organizer for a new code.",
        410,
      );
    }
    throw new DomainError(
      "join_code_unknown",
      "That code does not match an open event. Check it with your organizer.",
      404,
    );
  }

  const displayName = input.displayName.trim() || input.email.split("@")[0];
  const email = input.email.trim();

  // `on conflict do nothing` makes the unique (event_id, user_id) index the
  // arbiter of "one entry per event", even when two tabs submit at once.
  await getDb()
    .insert(participants)
    .values({ eventId: event.id, userId: input.userId, displayName, email })
    .onConflictDoNothing({
      target: [participants.eventId, participants.userId],
    });

  const [row] = await getDb()
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.eventId, event.id),
        eq(participants.userId, input.userId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new DomainError(
      "join_failed",
      "Could not enter the event. Try again.",
      500,
    );
  }

  return {
    eventCode: event.code,
    eventStatus: event.status === "live" ? "live" : "draft",
    participantId: row.id,
  };
}
