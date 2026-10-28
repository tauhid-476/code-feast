import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The fullscreen gate, as a browser cookie. Fullscreen can only be granted from
 * a user gesture, so the server cannot watch for it; it can only remember that
 * the enter action ran after `requestFullscreen()` resolved. The token names the
 * event and the participant and carries its own expiry, so a code reused by a
 * later event, another participant's token, or a hand-written value does not
 * open the contest.
 *
 * This is a UX gate, not authorization: every read still resolves the session
 * and the participant row. The signature only stops a token being edited.
 */

/** Long enough for refresh, reconnect, and an extended contest; not a session. */
export const GATE_TTL_MS = 6 * 60 * 60 * 1000;

export type GateClaims = {
  eventId: string;
  participantId: string;
  expiresAtMs: number;
};

export type GateExpectation = {
  eventId: string;
  participantId: string;
  now: Date;
  secret: string;
};

/** One cookie per event, so entering one event never opens another. */
export function gateCookieName(code: string): string {
  return `cf_gate_${code.trim().toUpperCase()}`;
}

function payload(claims: GateClaims): string {
  return `${claims.eventId}.${claims.participantId}.${claims.expiresAtMs}`;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signGateToken(claims: GateClaims, secret: string): string {
  const body = payload(claims);
  return `${body}.${signature(body, secret)}`;
}

/**
 * True only for a token this server signed, for this event and participant,
 * that has not expired. `now` is passed in so tests can move the clock.
 */
export function isGateTokenValid(
  token: string | undefined | null,
  expected: GateExpectation,
): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 4) return false;

  const [eventId, participantId, expiresAt, provided] = parts;
  if (eventId !== expected.eventId) return false;
  if (participantId !== expected.participantId) return false;

  const expiresAtMs = Number(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return false;
  if (expected.now.getTime() >= expiresAtMs) return false;

  const wanted = signature(`${eventId}.${participantId}.${expiresAt}`, expected.secret);
  const providedBytes = Buffer.from(provided);
  const wantedBytes = Buffer.from(wanted);
  if (providedBytes.length !== wantedBytes.length) return false;

  return timingSafeEqual(providedBytes, wantedBytes);
}
