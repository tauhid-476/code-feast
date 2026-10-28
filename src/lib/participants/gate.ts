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
 * Reading and writing the fullscreen gate cookie. The decision itself lives in
 * `gate-token.ts` and `routes.ts`; this file only moves the value in and out of
 * the response.
 *
 * The signature reuses the auth cookie secret rather than adding an environment
 * variable. It is not an authorization check — every read still resolves the
 * participant through `loadParticipantContext` — it only stops a token being
 * edited to name another participant or event.
 */

export type GateTarget = {
  eventId: string;
  participantId: string;
};

function secret(): string {
  return neonAuthCookieSecret();
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
 * client reports that `requestFullscreen()` resolved. The cookie is scoped to
 * the event path so entering one event never opens another.
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
  store.set(gateCookieName(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/e/${code.trim().toUpperCase()}`,
    expires: expiresAt,
  });
}

/** Clears the gate; used when a participant's contest is over. */
export async function clearContestGate(code: string): Promise<void> {
  const store = await cookies();
  store.delete(gateCookieName(code));
}
