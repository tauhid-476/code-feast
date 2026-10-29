import { and, desc, eq } from "drizzle-orm";
import { shouldCountStrike } from "@/lib/contest/anti-cheat";
import { getDb, type Transaction } from "@/lib/db/client";
import { participants, violations } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import {
  finalizeLockout,
  participantColumns,
  toParticipant,
  type Participant,
  type ParticipantRow,
  type ParticipantStatus,
} from "@/lib/participants/lockout";
import type { ParticipantContext } from "@/lib/participants/queries";
import { requireActiveSession } from "@/lib/participants/session";
import { now as serverNow } from "@/lib/time";
import { requireRecordingParticipant } from "./guard";
import { STRIKE_LIMIT, type CountedViolationKind } from "./kinds";

/**
 * Counted Anti-cheat (SPEC §6). One signal is one strike, unless a counted
 * strike landed within the two-second window — then it is the same event
 * arriving twice. The third strike is the lockout: the Participant is frozen
 * with reason `eliminated` and the Submission is written from their autosaved
 * drafts in the same transaction.
 *
 * The participant row is locked `FOR UPDATE` before the dedupe read, because
 * `blur` and `fullscreenchange` arrive as two requests: without the lock both
 * would see an empty history and both would count.
 */

export type RecordStrikeInput = {
  kind: CountedViolationKind;
};

export type RecordStrikeOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
  /**
   * The browser session making the report. A displaced session may not earn
   * strikes any more (ticket 14); the check is repeated on the locked row below
   * so a takeover that lands mid-request is still honoured.
   */
  sessionId?: string | null;
};

export type StrikeOutcome = {
  /** False when the signal landed inside the dedupe window. */
  counted: boolean;
  violationId: string | null;
  strikes: number;
  status: ParticipantStatus;
  eliminated: boolean;
  lockedAt: Date | null;
};

/**
 * The counted write itself, on a transaction whose caller already holds the
 * participant row `FOR UPDATE`. Ticket 14's takeover is one row lock around
 * "this session is now the active one" and "that is one strike", so the two
 * halves have to share a transaction rather than nest one inside the other.
 */
export async function countStrike(
  tx: Transaction,
  current: Participant,
  input: RecordStrikeInput,
  createdAt: Date,
): Promise<StrikeOutcome> {
  const [last] = await tx
    .select({ createdAt: violations.createdAt })
    .from(violations)
    .where(
      and(
        eq(violations.participantId, current.id),
        eq(violations.counted, true),
      ),
    )
    .orderBy(desc(violations.createdAt))
    .limit(1);

  if (last && !shouldCountStrike(last.createdAt.getTime(), createdAt.getTime())) {
    return {
      counted: false,
      violationId: null,
      strikes: current.strikes,
      status: current.status,
      eliminated: false,
      lockedAt: current.lockedAt,
    };
  }

  const [logged] = await tx
    .insert(violations)
    .values({
      participantId: current.id,
      kind: input.kind,
      counted: true,
      createdAt,
    })
    .returning({ id: violations.id });

  const strikes = Math.min(current.strikes + 1, STRIKE_LIMIT);
  await tx
    .update(participants)
    .set({ strikes })
    .where(eq(participants.id, current.id));

  if (strikes < STRIKE_LIMIT) {
    return {
      counted: true,
      violationId: logged.id,
      strikes,
      status: current.status,
      eliminated: false,
      lockedAt: null,
    };
  }

  const locked = await finalizeLockout(tx, current.id, {
    reason: "eliminated",
    lockedAt: createdAt,
  });

  return {
    counted: true,
    violationId: logged.id,
    strikes,
    status: "locked_out",
    eliminated: locked !== null,
    lockedAt: locked?.lockedAt ?? null,
  };
}

export async function recordStrike(
  context: ParticipantContext | null,
  input: RecordStrikeInput,
  options: RecordStrikeOptions = {},
): Promise<StrikeOutcome> {
  const { participant } = requireRecordingParticipant(context);
  const sessionId = options.sessionId ?? null;
  const createdAt = options.now ?? serverNow();

  return getDb().transaction(async (tx) => {
    const [currentRow] = await tx
      .select(participantColumns)
      .from(participants)
      .where(eq(participants.id, participant.id))
      .for("update");

    if (!currentRow) {
      throw new DomainError("not_joined", "Join this event first.", 403);
    }
    const current = toParticipant(currentRow as ParticipantRow);
    if (current.status === "locked_out") {
      throw new DomainError(
        "contest_locked",
        "Your contest is locked, so nothing more is recorded.",
        409,
      );
    }
    requireActiveSession(current, sessionId);

    return countStrike(tx, current, input, createdAt);
  });
}
