import { getDb } from "@/lib/db/client";
import { violations } from "@/lib/db/schema";
import type { ParticipantContext } from "@/lib/participants/queries";
import { now as serverNow } from "@/lib/time";
import { requireRecordingParticipant } from "./guard";
import { isUncountedViolationKind, type ViolationKind } from "./kinds";

/**
 * Record one prevented attempt against the Participant, server-side, so a
 * refresh or a wiped tab cannot erase it.
 *
 * This is the uncounted half of SPEC §6: a blocked paste or a suppressed
 * context menu is logged for the Organizer and costs nothing. A counted kind is
 * a programmer error here — strikes go through `recordStrike`, which owns the
 * dedupe, the counter, and the elimination.
 *
 * The context comes from the loader, so the Deadline was already reconciled on
 * the way in, and a signal after it is refused rather than recorded.
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
  if (!isUncountedViolationKind(input.kind)) {
    throw new Error(
      `logViolation records prevented attempts only; ${input.kind} is a counted strike.`,
    );
  }

  const { participant } = requireRecordingParticipant(context);
  const createdAt = options.now ?? serverNow();

  const [row] = await getDb()
    .insert(violations)
    .values({
      participantId: participant.id,
      kind: input.kind,
      counted: false,
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
