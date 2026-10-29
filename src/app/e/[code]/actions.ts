"use server";

import { requireParticipant } from "@/lib/auth/guards";
import { submitContest } from "@/lib/contest/submit";
import { actionError, isDomainError } from "@/lib/errors";
import {
  clearContestGate,
  grantContestGate,
  readContestGate,
} from "@/lib/participants/gate";
import { markSolving } from "@/lib/participants/lockout";
import { loadParticipantContext } from "@/lib/participants/queries";
import { contestDestination } from "@/lib/participants/routes";
import { now as serverNow } from "@/lib/time";

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

export type SubmitContestResult = { error: string } | { href: string };

/**
 * The Participant's Submit (SPEC §5.7). The client asks for confirmation first;
 * this action is the write. It clears the fullscreen gate either way, so the
 * terminal screen is not backed by a cookie that still opens the editor.
 *
 * A participant already locked is sent to the terminal screen instead of
 * seeing an error: the refusal is that no second Submission is written.
 */
export async function submitContestAction(
  code: string,
): Promise<SubmitContestResult> {
  const user = await requireParticipant();
  const context = await loadParticipantContext(code, user.id);

  if (!context || !context.participant) {
    return { error: "Join this event before submitting." };
  }

  const lockedHref = `/e/${context.event.code}/locked`;

  if (context.participant.status === "locked_out") {
    await clearContestGate(context.event.code);
    return { href: lockedHref };
  }

  try {
    await submitContest(context, { now: serverNow() });
  } catch (error) {
    if (isDomainError(error) && error.code === "contest_locked") {
      await clearContestGate(context.event.code);
      return { href: lockedHref };
    }
    return actionError(error);
  }

  await clearContestGate(context.event.code);
  return { href: lockedHref };
}
