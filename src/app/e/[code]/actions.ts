"use server";

import { requireParticipant } from "@/lib/auth/guards";
import { startContestSession } from "@/lib/contest/session";
import { submitContest } from "@/lib/contest/submit";
import { actionError, isDomainError } from "@/lib/errors";
import {
  clearContestGate,
  ensureContestSession,
  grantContestGate,
  readContestGate,
  readContestSession,
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
 *
 * And it is where the browser becomes this Participant's session (SPEC §6,
 * ticket 14). The newest session wins: a second browser entering displaces the
 * first, which turns read-only and costs one strike. Opening the same browser
 * again keeps the session it already has, so a refresh is not a duplicate.
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

  const at = serverNow();
  const sessionId = await ensureContestSession(code, at);
  const lockedHref = `/e/${context.event.code}/locked`;

  try {
    const claim = await startContestSession(context, { sessionId }, { now: at });
    if (claim.status === "locked_out") {
      await clearContestGate(code);
      return { href: lockedHref };
    }
  } catch (error) {
    // A takeover that was the third strike, or a session that lost a race with
    // the Deadline: the contest is over for this browser either way.
    if (isDomainError(error) && error.code === "contest_locked") {
      await clearContestGate(code);
      return { href: lockedHref };
    }
    return actionError(error);
  }

  return { href: `/e/${context.event.code}/contest` };
}

export type SubmitContestResult = { error: string } | { href: string };

/**
 * The Participant's Submit (SPEC §5.7). The client asks for confirmation first;
 * this action is the write. It clears the fullscreen gate and the session either
 * way, so the terminal screen is not backed by a cookie that still opens the
 * editor.
 *
 * A participant already locked is sent to the terminal screen instead of
 * seeing an error: the refusal is that no second Submission is written.
 *
 * A displaced session is refused by `submitContest` (ticket 14): the older tab
 * cannot freeze the winner's work on its way out.
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
    await submitContest(context, {
      now: serverNow(),
      sessionId: await readContestSession(code),
    });
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
