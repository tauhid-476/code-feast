import { DomainError } from "@/lib/errors";
import type { EventSummary } from "@/lib/events/queries";
import type {
  Participant,
  ParticipantContext,
} from "@/lib/participants/queries";

/**
 * The refusals shared by every write against a live contest. The context comes
 * from the loader, so the Deadline was already reconciled on the way in: a
 * signal that arrives after it is refused rather than recorded.
 */

export type RecordingTarget = {
  event: EventSummary;
  participant: Participant;
};

export function requireRecordingParticipant(
  context: ParticipantContext | null,
): RecordingTarget {
  const participant = context?.participant;
  if (!participant) {
    throw new DomainError("not_joined", "Join this event first.", 403);
  }
  if (participant.status === "locked_out") {
    throw new DomainError(
      "contest_locked",
      "Your contest is locked, so nothing more is recorded.",
      409,
    );
  }
  if (context.event.status !== "live") {
    throw new DomainError(
      "contest_not_open",
      "This event is not live, so nothing is recorded.",
      409,
    );
  }

  return { event: context.event, participant };
}
