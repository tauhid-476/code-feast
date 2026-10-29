import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { neonAuthCookieSecret } from "@/lib/env";
import { now as serverNow } from "@/lib/time";
import {
  GATE_TTL_MS,
  gateCookieName,
  isGateTokenValid,
  signGateToken,
} from "./gate-token";

/**
 * Reading and writing the two per-event cookies a contest browser carries.
 *
 * - The gate says this browser crossed the fullscreen gate for this event and
 *   participant. The decision itself lives in `gate-token.ts` and `routes.ts`.
 * - The session says which browser holds the contest when the same Participant
 *   opens it somewhere else (ticket 14). It is a random id, minted by the enter
 *   action, that `participants.active_session_id` compares against. Server-minted
 *   and http-only, so a displaced tab cannot rename itself back in.
 *
 * Neither is authorization: every read still resolves the participant through
 * `loadParticipantContext`.
 */

export type GateTarget = {
  eventId: string;
  participantId: string;
};

function secret(): string {
  return neonAuthCookieSecret();
}

/** Scoped to the event path so a cookie for one event never opens another. */
function cookieOptions(code: string, at: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: `/e/${code.trim().toUpperCase()}`,
    expires: new Date(at.getTime() + GATE_TTL_MS),
  };
}

/** Whether this request carries a valid gate token for this event + participant. */
export async function readContestGate(
  code: string,
  target: GateTarget,
  at: Date = serverNow(),
): Promise<boolean> {
  const store = await cookies();
  const token = store.get(gateCookieName(code))?.value;

  return isGateTokenValid(token, {
    eventId: target.eventId,
    participantId: target.participantId,
    now: at,
    secret: secret(),
  });
}

/**
 * Grants the gate for six hours. Called only by the enter action, after the
 * client reports that `requestFullscreen()` resolved.
 */
export async function grantContestGate(
  code: string,
  target: GateTarget,
  at: Date = serverNow(),
): Promise<void> {
  const expiresAt = new Date(at.getTime() + GATE_TTL_MS);
  const token = signGateToken(
    {
      eventId: target.eventId,
      participantId: target.participantId,
      expiresAtMs: expiresAt.getTime(),
    },
    secret(),
  );

  const store = await cookies();
  store.set(gateCookieName(code), token, cookieOptions(code, at));
}

/** One cookie per event, like the gate, so two events never share a session. */
export function sessionCookieName(code: string): string {
  return `cf_session_${code.trim().toUpperCase()}`;
}

/** The session this browser holds for the event, if any. */
export async function readContestSession(code: string): Promise<string | null> {
  const store = await cookies();
  return store.get(sessionCookieName(code))?.value ?? null;
}

/**
 * The enter action's session: the one this browser already holds, or a fresh
 * one. Minting here rather than in a page render is what makes a second
 * browser's entry a new session and a refresh the same one.
 */
export async function ensureContestSession(
  code: string,
  at: Date = serverNow(),
): Promise<string> {
  const store = await cookies();
  const existing = store.get(sessionCookieName(code))?.value;
  if (existing) return existing;

  const sessionId = randomUUID();
  store.set(sessionCookieName(code), sessionId, cookieOptions(code, at));
  return sessionId;
}

/** Clears the gate and the session; used when a contest is over for this browser. */
export async function clearContestGate(code: string): Promise<void> {
  const store = await cookies();
  store.delete(gateCookieName(code));
  store.delete(sessionCookieName(code));
}
