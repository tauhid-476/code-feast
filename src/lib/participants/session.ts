import { DomainError } from "@/lib/errors";
import { sessionSupersededMessage } from "@/lib/contest/copy";

/**
 * Which tab holds a Participant's live contest (SPEC §6, SPEC §10).
 *
 * A session belongs to one browser tab: the tab claims one when it first opens
 * the contest, the server mints the id, and the tab keeps it in `sessionStorage`
 * so a refresh is the same session while a new tab is a new one. The newest tab
 * wins; the one it displaced is read-only — refused by the server at every
 * write, not by the tab choosing to stop.
 *
 * The id travels on every contest request (`x-contest-session` for the route
 * handlers, an argument to the Submit action). A request without it is refused
 * once a tab holds the contest; only the session action may mint, and minting
 * always takes over and costs the strike.
 *
 * A Participant with no session yet has nothing to compare against: rows from
 * before ticket 14, a lobby, or a fixture. The first tab to claim becomes the
 * active one.
 */

/** Shared by the route handlers and the browser; not a secret, an identity. */
export const CONTEST_SESSION_HEADER = "x-contest-session";

export type SessionHolder = {
  activeSessionId: string | null;
};

/** True when this tab is the one allowed to write for this Participant. */
export function isActiveSession(
  participant: SessionHolder,
  sessionId: string | null,
): boolean {
  if (!participant.activeSessionId) return true;
  return sessionId !== null && sessionId === participant.activeSessionId;
}

/**
 * The refusal every contest write shares. A missing id is a refusal too: that
 * is what stops a displaced tab from dropping its header to look like the
 * first one.
 */
export function requireActiveSession(
  participant: SessionHolder,
  sessionId: string | null,
): void {
  if (isActiveSession(participant, sessionId)) return;

  throw new DomainError(
    "session_superseded",
    sessionSupersededMessage(),
    409,
  );
}
