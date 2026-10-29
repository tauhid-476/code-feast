import { DomainError } from "@/lib/errors";
import { sessionSupersededMessage } from "@/lib/contest/copy";

/**
 * Which browser holds a Participant's live contest (SPEC §6, SPEC §10).
 *
 * A session is the fullscreen gate a browser came through: the enter action
 * mints one random id per browser and writes it to `participants.active_session_id`.
 * The newest one wins. Every write against the contest names its session, and
 * the one that no longer matches is read-only — refused by the server, not by
 * the tab choosing to stop.
 *
 * A Participant with no session yet has nothing to compare against: rows from
 * before ticket 14, a lobby, or a fixture. The first session to claim becomes
 * the active one, so this is never a way for a displaced session to write.
 */

export const SESSION_SUPERSEDED_CODE = "session_superseded";

export type SessionHolder = {
  activeSessionId: string | null;
};

/** True when this session is the one allowed to write for this Participant. */
export function isActiveSession(
  participant: SessionHolder,
  sessionId: string | null,
): boolean {
  if (!participant.activeSessionId) return true;
  return sessionId !== null && sessionId === participant.activeSessionId;
}

/**
 * The refusal every contest write shares. `sessionId` is the caller's browser
 * session, read from its cookie; a missing one is a refusal once another
 * session holds the participant.
 */
export function requireActiveSession(
  participant: SessionHolder,
  sessionId: string | null,
): void {
  if (isActiveSession(participant, sessionId)) return;

  throw new DomainError(
    SESSION_SUPERSEDED_CODE,
    sessionSupersededMessage(),
    409,
  );
}
