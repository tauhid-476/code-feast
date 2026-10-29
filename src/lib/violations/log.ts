import { getDb } from "@/lib/db/client";
import { violations } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import type { ParticipantContext } from "@/lib/participants/queries";
import { now as serverNow } from "@/lib/time";
import { isUncountedViolationKind, type ViolationKind } from "./kinds";

/**
 * Record one Anti-cheat event against the Participant, server-side, so a
 * refresh or a wiped tab cannot erase it.
 *
 * The context comes from the loader, so the Deadline was already reconciled on
 * the way in. Counted kinds (ticket 13) will add the strike and the elimination
 * here; a blocked attempt only writes its row and costs nothing.
 */

export type LogViolationInput = {
  kind: ViolationKind;
  /** Blocked kinds are uncounted by kind, whatever the caller says. */
  counted?: boolean;
};

export type LogViolationOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

export type LoggedViolation = {
  id: string;
  participantId: string;
  kind: ViolationKind;
  counted: boolean;
  createdAt: Date;
};

export async function logViolation(
  context: ParticipantContext | null,
  input: LogViolationInput,
  options: LogViolationOptions = {},
): Promise<LoggedViolation> {
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

  const counted = isUncountedViolationKind(input.kind)
    ? false
    : (input.counted ?? true);
  const createdAt = options.now ?? serverNow();

  const [row] = await getDb()
    .insert(violations)
    .values({
      participantId: participant.id,
      kind: input.kind,
      counted,
      createdAt,
    })
    .returning({
      id: violations.id,
      participantId: violations.participantId,
      kind: violations.kind,
      counted: violations.counted,
      createdAt: violations.createdAt,
    });

  return { ...row, kind: row.kind as ViolationKind };
}
