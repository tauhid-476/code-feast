import {
  violatingHeartbeatKinds,
  type HeartbeatReport,
} from "@/lib/contest/heartbeat";
import type { ParticipantStatus } from "@/lib/participants/lockout";
import type { ParticipantContext } from "@/lib/participants/queries";
import { now as serverNow } from "@/lib/time";
import { requireRecordingParticipant } from "./guard";
import { recordStrike } from "./strikes";

/**
 * The server side of the five-second heartbeat (SPEC §6). A beat that reports
 * a violation the client never reported costs a strike; a beat that reports
 * the same event the client just reported lands inside `recordStrike`'s
 * two-second window and costs nothing.
 *
 * A clean beat writes nothing at all — it is a report, not a record.
 */

export type RecordHeartbeatOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

export type HeartbeatOutcome = {
  strikes: number;
  status: ParticipantStatus;
  /** How many strikes this beat added; 0 or 1 in practice. */
  counted: number;
  eliminated: boolean;
};

export async function recordHeartbeat(
  context: ParticipantContext | null,
  report: HeartbeatReport,
  options: RecordHeartbeatOptions = {},
): Promise<HeartbeatOutcome> {
  // Refuse a beat from a non-participant or a locked contest before looking at
  // its contents: the answer is the same whether the beat is clean or not.
  const { participant } = requireRecordingParticipant(context);
  const at = options.now ?? serverNow();

  let outcome: HeartbeatOutcome = {
    strikes: participant.strikes,
    status: participant.status,
    counted: 0,
    eliminated: false,
  };

  for (const kind of violatingHeartbeatKinds(report)) {
    const strike = await recordStrike(context, { kind }, { now: at });
    if (strike.counted) outcome.counted += 1;
    outcome = {
      strikes: strike.strikes,
      status: strike.status,
      counted: outcome.counted,
      eliminated: outcome.eliminated || strike.eliminated,
    };
    if (strike.eliminated) break;
  }

  return outcome;
}
