"use server";

import { requireParticipant } from "@/lib/auth/guards";
import { now as serverNow } from "@/lib/time";
import { grantContestGate, readContestGate } from "@/lib/participants/gate";
import { markSolving } from "@/lib/participants/lockout";
import { loadParticipantContext } from "@/lib/participants/queries";
import { contestDestination } from "@/lib/participants/routes";

export type EnterContestResult = { error: string } | { href: string };

/**
 * The Lobby's "Enter fullscreen" action, called by the client only after the
 * browser has granted fullscreen. This is where the server learns "entered"
 * rather than "typed the URL": a signed, http-only, event-scoped cookie.
 *
 * It also marks the participant solving, which Start deliberately does not do on
 * their behalf (ticket 08).
 */
export async function enterContestAction(
  code: string,
): Promise<EnterContestResult> {
  const user = await requireParticipant();
  const context = await loadParticipantContext(code, user.id);

  if (!context || !context.participant) {
    return { error: "Join this event before entering it." };
  }

  const target = {
    eventId: context.event.id,
    participantId: context.participant.id,
  };
  const entered = await readContestGate(code, target);
  const destination = contestDestination(context, { entered });

  // Locked, ended, still draft, or already through the gate: send them where
  // they belong instead of minting a gate for a contest they cannot enter.
  if (
    context.participant.status === "locked_out" ||
    context.event.status !== "live"
  ) {
    return { href: destination ?? `/e/${context.event.code}` };
  }

  if (!entered) {
    await markSolving(context.participant.id, serverNow());
    await grantContestGate(code, target);
  }

  return { href: `/e/${context.event.code}/contest` };
}
