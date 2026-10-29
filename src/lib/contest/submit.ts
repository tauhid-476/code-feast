import { getDb } from "@/lib/db/client";
import { DomainError } from "@/lib/errors";
import { finalizeLockout, type Participant } from "@/lib/participants/lockout";
import type { ParticipantContext } from "@/lib/participants/queries";
import { now as serverNow } from "@/lib/time";

/**
 * The Participant's one irreversible action (SPEC §5.7): freeze their work and
 * lock them out with reason `submitted`.
 *
 * The context comes from the loader, so the Deadline has already been
 * reconciled on the way in. The lock itself is conditional on the participant
 * not being locked, so a double click, a stale tab, or a retried request cannot
 * write a second Submission.
 */

export type SubmitOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

export async function submitContest(
  context: ParticipantContext | null,
  options: SubmitOptions = {},
): Promise<Participant> {
  const participant = context?.participant;
  if (!participant) {
    throw new DomainError(
      "not_joined",
      "Join this event before submitting.",
      403,
    );
  }
  if (participant.status === "locked_out") {
    throw new DomainError(
      "contest_locked",
      "Your contest is already locked. A submission is final.",
      409,
    );
  }
  if (context.event.status !== "live") {
    throw new DomainError(
      "contest_not_open",
      "This event is not live. Submissions open when the organizer starts it.",
      409,
    );
  }

  const at = options.now ?? serverNow();
  const deadlineAt = context.event.deadlineAt;

  // The Deadline wins over a Submit that lands on or after it: the participant
  // is locked at the Deadline, with the deadline reason, like any other read.
  if (deadlineAt && at.getTime() >= deadlineAt.getTime()) {
    const lockedByDeadline = await getDb().transaction((tx) =>
      finalizeLockout(tx, participant.id, {
        reason: "deadline",
        lockedAt: deadlineAt,
      }),
    );
    if (lockedByDeadline) return lockedByDeadline;
  }

  const locked = await getDb().transaction((tx) =>
    finalizeLockout(tx, participant.id, {
      reason: "submitted",
      lockedAt: at,
    }),
  );

  if (!locked) {
    throw new DomainError(
      "contest_locked",
      "Your contest is already locked. A submission is final.",
      409,
    );
  }

  return locked;
}
