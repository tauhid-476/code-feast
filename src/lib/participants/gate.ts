import "server-only";

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
 * Reading and writing the per-event fullscreen gate cookie.
 *
 * The gate says this browser crossed the fullscreen gate for this event and
 * participant. The decision itself lives in `gate-token.ts` and `routes.ts`.
 *
 * It is not the contest session (ticket 14): a session belongs to one tab and
 * lives in that tab's `sessionStorage`, because a cookie would make two tabs of
 * one browser the same session. Nor is the gate authorization: every read still
 * resolves the participant through `loadParticipantContext`.
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

/** Clears the gate; used when a contest is over for this browser. */
export async function clearContestGate(code: string): Promise<void> {
  const store = await cookies();
  store.delete(gateCookieName(code));
}
