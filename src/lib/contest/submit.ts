import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import {
  finalizeLockout,
  participantColumns,
  toParticipant,
  type Participant,
  type ParticipantRow,
} from "@/lib/participants/lockout";
import type { ParticipantContext } from "@/lib/participants/queries";
import { requireActiveSession } from "@/lib/participants/session";
import { now as serverNow } from "@/lib/time";

/**
 * The Participant's one irreversible action (SPEC §5.7): freeze their work and
 * lock them out with reason `submitted`.
 *
 * The context comes from the loader, so the Deadline has already been
 * reconciled on the way in. The lock itself is conditional on the participant
 * not being locked, so a double click, a stale tab, or a retried request cannot
 * write a second Submission. A displaced session cannot submit either: the
 * check is repeated on the locked row so a tab that lost the contest a moment
 * ago cannot freeze the winner's work on its way out (ticket 14).
 */

export type SubmitOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
  /** The browser session submitting. */
  sessionId?: string | null;
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
  const sessionId = options.sessionId ?? null;

  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select(participantColumns)
      .from(participants)
      .where(eq(participants.id, participant.id))
      .for("update");

    if (!row) {
      throw new DomainError(
        "not_joined",
        "Join this event before submitting.",
        403,
      );
    }
    const current = toParticipant(row as ParticipantRow);
    if (current.status === "locked_out") {
      throw new DomainError(
        "contest_locked",
        "Your contest is already locked. A submission is final.",
        409,
      );
    }
    requireActiveSession(current, sessionId);

    // The Deadline wins over a Submit that lands on or after it: the participant
    // is locked at the Deadline, with the deadline reason, like any other read.
    if (deadlineAt && at.getTime() >= deadlineAt.getTime()) {
      const lockedByDeadline = await finalizeLockout(tx, current.id, {
        reason: "deadline",
        lockedAt: deadlineAt,
      });
      if (lockedByDeadline) return lockedByDeadline;
    }

    const locked = await finalizeLockout(tx, current.id, {
      reason: "submitted",
      lockedAt: at,
    });

    if (!locked) {
      throw new DomainError(
        "contest_locked",
        "Your contest is already locked. A submission is final.",
        409,
      );
    }

    return locked;
  });
}
