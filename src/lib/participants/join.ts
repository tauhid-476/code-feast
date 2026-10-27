import { DomainError } from "@/lib/errors";

export type JoinResult = {
  eventCode: string;
};

/**
 * Seam owned by ticket 07 (join by code). Ticket 01 only needs the entry
 * surface to exist for a Participant.
 */
export async function joinEventByCode(_input: {
  userId: string;
  displayName: string;
  email: string;
  code: string;
}): Promise<JoinResult> {
  throw new DomainError(
    "join_not_available",
    "Joining is not open yet. Ask your organizer.",
  );
}
