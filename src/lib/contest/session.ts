import { randomUUID } from "node:crypto";
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
 * Which tab holds a Participant's live contest (SPEC §6, SPEC §10).
 *
 * A session is one browser tab. A tab arrives with no id, the server mints one,
 * and the tab keeps it in `sessionStorage`: a refresh is the same session, a new
 * tab is a new one. The newest tab wins; the tab it displaced is refused at
 * every write rather than asked to stop.
 *
 * Only the mint takes over, and taking over always costs the one
 * `duplicate_session` strike. A tab that arrives with an id only verifies it:
 * a displaced tab reloading here cannot claim the contest back, so two idle
 * tabs cannot ping-pong strikes between them.
 *
 * The mint is one transaction over a row locked `FOR UPDATE`, so two tabs
 * claiming together produce exactly one winner and exactly one strike. The
 * strike goes through `countStrike`, so the two-second window that keeps one
 * alt-tab at one strike applies here too — switching windows to the second tab
 * is the same gesture as the blur it caused.
 */

export type OpenSessionInput = {
  /**
   * The tab's session id, or null when it has none yet. Null mints a new one
   * and takes the contest over; a provided id is only ever verified.
   */
  sessionId: string | null;
};

export type OpenSessionOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

export type ContestSessionState = {
  /** The id this tab writes with: the one it brought, or the freshly minted one. */
  sessionId: string;
  /** False when another tab holds the contest; this tab is read-only. */
  active: boolean;
  /** True when a different session held the Participant and lost it. */
  takeover: boolean;
  /** False when the takeover landed inside the two-second strike window. */
  counted: boolean;
  strikes: number;
  status: ParticipantStatus;
  eliminated: boolean;
  lockedAt: Date | null;
};

export async function openContestSession(
  context: ParticipantContext | null,
  input: OpenSessionInput,
  options: OpenSessionOptions = {},
): Promise<ContestSessionState> {
  const { participant } = requireRecordingParticipant(context);
  const at = options.now ?? serverNow();
  const claimed = input.sessionId === null;
  const sessionId = input.sessionId ?? randomUUID();

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

    const held = current.activeSessionId;

    // A refresh, or the same tab reloading: the same session, not a duplicate.
    if (held === sessionId) {
      await tx
        .update(participants)
        .set({ lastSeenAt: at })
        .where(eq(participants.id, current.id));

      return {
        sessionId,
        active: true,
        takeover: false,
        counted: false,
        strikes: current.strikes,
        status: current.status,
        eliminated: false,
        lockedAt: current.lockedAt,
      };
    }

    // A tab that brought an id is only verified. It cannot take the contest
    // back, which is what stops a refresh in a displaced tab from flipping the
    // two tabs (and charging a strike) on every reload.
    if (!claimed) {
      // Nothing holds the contest — a row from before this ticket, or one whose
      // holder was cleared. Adopting the id costs nothing because nobody lost.
      if (held === null) {
        await tx
          .update(participants)
          .set({ activeSessionId: sessionId, lastSeenAt: at })
          .where(eq(participants.id, current.id));

        return {
          sessionId,
          active: true,
          takeover: false,
          counted: false,
          strikes: current.strikes,
          status: current.status,
          eliminated: false,
          lockedAt: current.lockedAt,
        };
      }

      return {
        sessionId,
        active: false,
        takeover: false,
        counted: false,
        strikes: current.strikes,
        status: current.status,
        eliminated: false,
        lockedAt: current.lockedAt,
      };
    }

    const takeover = held !== null;
    await tx
      .update(participants)
      .set({ activeSessionId: sessionId, lastSeenAt: at })
      .where(eq(participants.id, current.id));

    if (!takeover) {
      return {
        sessionId,
        active: true,
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
      sessionId,
      active: true,
      takeover: true,
      counted: strike.counted,
      strikes: strike.strikes,
      status: strike.status,
      eliminated: strike.eliminated,
      lockedAt: strike.lockedAt,
    };
  });
}
