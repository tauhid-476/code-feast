import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import {
  participantColumns,
  toParticipant,
  type ParticipantRow,
  type ParticipantStatus,
} from "@/lib/participants/lockout";
import type { ParticipantContext } from "@/lib/participants/queries";
import { now as serverNow } from "@/lib/time";
import { requireRecordingParticipant } from "@/lib/violations/guard";
import { countStrike } from "@/lib/violations/strikes";

/**
 * Opening the contest in a browser (SPEC §6, SPEC §10). The newest session
 * wins; the one it displaced becomes read-only and the Participant is charged
 * one strike for holding the event open twice.
 *
 * The claim and the strike are one transaction over a row locked `FOR UPDATE`:
 * two browsers arriving together produce exactly one winner and exactly one
 * strike, and a refresh of the winning session produces neither. The strike
 * goes through `countStrike`, so the two-second window that keeps one alt-tab
 * at one strike applies here too — switching windows to the second browser is
 * the same gesture as the blur it caused.
 */

export type StartSessionInput = {
  /**
   * The browser session: a random id minted by the enter action and kept in an
   * http-only cookie scoped to this event. Server-minted, so a displaced tab
   * cannot name itself back into the contest.
   */
  sessionId: string;
};

export type StartSessionOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

export type ContestSessionClaim = {
  /** True when a different session held the Participant and lost it. */
  takeover: boolean;
  /** False when the takeover landed inside the two-second strike window. */
  counted: boolean;
  strikes: number;
  status: ParticipantStatus;
  eliminated: boolean;
  lockedAt: Date | null;
};

export async function startContestSession(
  context: ParticipantContext | null,
  input: StartSessionInput,
  options: StartSessionOptions = {},
): Promise<ContestSessionClaim> {
  const { participant } = requireRecordingParticipant(context);
  const at = options.now ?? serverNow();

  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select(participantColumns)
      .from(participants)
      .where(eq(participants.id, participant.id))
      .for("update");

    if (!row) {
      throw new DomainError("not_joined", "Join this event first.", 403);
    }
    const current = toParticipant(row as ParticipantRow);
    if (current.status === "locked_out") {
      throw new DomainError(
        "contest_locked",
        "Your contest is locked, so no session can open it.",
        409,
      );
    }

    // A refresh, or the same tab reloading: the same session, not a duplicate.
    if (current.activeSessionId === input.sessionId) {
      await tx
        .update(participants)
        .set({ lastSeenAt: at })
        .where(eq(participants.id, current.id));

      return {
        takeover: false,
        counted: false,
        strikes: current.strikes,
        status: current.status,
        eliminated: false,
        lockedAt: current.lockedAt,
      };
    }

    const takeover = current.activeSessionId !== null;
    await tx
      .update(participants)
      .set({ activeSessionId: input.sessionId, lastSeenAt: at })
      .where(eq(participants.id, current.id));

    if (!takeover) {
      return {
        takeover: false,
        counted: false,
        strikes: current.strikes,
        status: current.status,
        eliminated: false,
        lockedAt: current.lockedAt,
      };
    }

    const strike = await countStrike(
      tx,
      current,
      { kind: "duplicate_session" },
      at,
    );

    return {
      takeover: true,
      counted: strike.counted,
      strikes: strike.strikes,
      status: strike.status,
      eliminated: strike.eliminated,
      lockedAt: strike.lockedAt,
    };
  });
}
