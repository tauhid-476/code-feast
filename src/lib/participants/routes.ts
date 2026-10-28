import type { ParticipantContext } from "./queries";

/**
 * Where a participant belongs given what the loader found. `null` means "stay
 * here". Both the lobby and the contest read this so the gates cannot drift.
 *
 * `entered` is the fullscreen gate: it comes from the signed cookie the enter
 * action sets after the browser granted fullscreen. Keeping the decision here
 * means the server — not client state — decides whether the contest route is
 * reachable.
 */
export type ContestGate = { entered: boolean };

export function lobbyDestination(
  context: ParticipantContext | null,
  gate: ContestGate = { entered: false },
): string | null {
  if (!context || !context.participant) return "/join";

  const base = `/e/${context.event.code}`;
  if (context.participant.status === "locked_out") return `${base}/locked`;
  if (context.event.status === "ended") return `${base}/locked`;
  if (context.event.status === "live") {
    // Live and already through the gate: the lobby has nothing left to show.
    return gate.entered ? `${base}/contest` : null;
  }
  return null;
}

export function contestDestination(
  context: ParticipantContext | null,
  gate: ContestGate = { entered: false },
): string | null {
  if (!context || !context.participant) return "/join";

  const base = `/e/${context.event.code}`;
  if (context.participant.status === "locked_out") return `${base}/locked`;
  if (context.event.status === "ended") return `${base}/locked`;
  if (context.event.status !== "live") return base;

  // A typed URL without the gate cookie belongs back at the gate.
  return gate.entered ? null : base;
}
