import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { isApprovedOrganizer } from "@/lib/organizers/whitelist";
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
  if (await isApprovedOrganizer(input.email)) {
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
        409,
      );
    }
    throw new DomainError(
      "join_code_unknown",
      "That code does not match any open event. Double check the code.",
      404,
    );
  }

  const [existing] = await getDb()
    .select({
      id: participants.id,
      status: participants.status,
    })
    .from(participants)
    .where(
      and(
        eq(participants.eventId, event.id),
        eq(participants.userId, input.userId),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      eventCode: event.code,
      eventStatus: event.status as JoinEventStatus,
      participantId: existing.id,
    };
  }

  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new DomainError("display_name_required", "Enter your name.");
  }

  const [row] = await getDb()
    .insert(participants)
    .values({
      eventId: event.id,
      userId: input.userId,
      displayName,
      email: input.email.trim().toLowerCase(),
      status: "joined",
    })
    .returning({ id: participants.id });

  return {
    eventCode: event.code,
    eventStatus: event.status as JoinEventStatus,
    participantId: row.id,
  };
}
