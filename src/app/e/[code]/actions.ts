"use server";

import { requireParticipant } from "@/lib/auth/guards";
import { openContestSession } from "@/lib/contest/session";
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
 *
 * It deliberately does not touch the contest session (ticket 14). A session
 * belongs to one tab, so the id the tab keeps in `sessionStorage` has to be
 * claimed from the contest page itself: this action is reachable from the lobby,
 * where a second tab entry would otherwise strike the first one before either
 * had rendered the contest.
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

export type ContestSessionResult =
  | { error: string; code?: string }
  | { href: string }
  | {
      /** The id this tab keeps in `sessionStorage` and writes with. */
      sessionId: string;
      /** False when another tab holds the contest: this one is read-only. */
      active: boolean;
      strikes: number;
    };

/**
 * The contest page's first request (ticket 14). The tab sends the id it kept in
 * `sessionStorage`, or null when it has none.
 *
 * Null mints a session and takes the contest over — the newest tab wins and the
 * displaced one costs the Participant one `duplicate_session` strike. An id is
 * only verified, so a displaced tab that reloads cannot claim the contest back,
 * and a refresh of the active tab is the same session: no strike, no takeover.
 *
 * The fullscreen gate is required. This action can be called directly, and a
 * session must not be minted for a browser that never crossed the gate.
 */
export async function contestSessionAction(
  code: string,
  sessionId: string | null,
): Promise<ContestSessionResult> {
  const user = await requireParticipant();
  const context = await loadParticipantContext(code, user.id);

  if (!context || !context.participant) {
    return { error: "Join this event before opening it." };
  }

  const entered = await readContestGate(code, {
    eventId: context.event.id,
    participantId: context.participant.id,
  });
  if (!entered) {
    return { error: "Enter the contest from the lobby first." };
  }

  const lockedHref = `/e/${context.event.code}/locked`;
  const at = serverNow();

  try {
    const state = await openContestSession(
      context,
      { sessionId },
      { now: at },
    );

    if (state.status === "locked_out") {
      await clearContestGate(context.event.code);
      return { href: lockedHref };
    }

    return {
      sessionId: state.sessionId,
      active: state.active,
      strikes: state.strikes,
    };
  } catch (error) {
    // The takeover that was the third strike, or a session that lost a race
    // with the Deadline: the contest is over for this tab either way.
    if (isDomainError(error) && error.code === "contest_locked") {
      await clearContestGate(context.event.code);
      return { href: lockedHref };
    }
    return actionError(error);
  }
}

export type SubmitContestResult =
  | { error: string; code?: string }
  | { href: string };

/**
 * The Participant's Submit (SPEC §5.7). The client asks for confirmation first;
 * this action is the write. It clears the fullscreen gate either way, so the
 * terminal screen is not backed by a cookie that still opens the editor.
 *
 * A participant already locked is sent to the terminal screen instead of
 * seeing an error: the refusal is that no second Submission is written.
 *
 * A displaced session is refused by `submitContest` (ticket 14): the older tab
 * cannot freeze the winner's work on its way out. The `code` on the result is
 * what lets the page show the takeover explanation instead of "Something went
 * wrong".
 */
export async function submitContestAction(
  code: string,
  sessionId: string | null,
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
    await submitContest(context, { now: serverNow(), sessionId });
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
