import type { ParticipantContext } from "./queries";

/**
 * Where a participant belongs given what the loader found. `null` means "stay
 * here". Both the lobby and the contest read this so the gates cannot drift.
 */
export function lobbyDestination(
  context: ParticipantContext | null,
): string | null {
  if (!context || !context.participant) return "/join";

  const base = `/e/${context.event.code}`;
  if (context.participant.status === "locked_out") return `${base}/locked`;
  if (context.event.status === "live") return `${base}/contest`;
  if (context.event.status === "ended") return `${base}/locked`;
  return null;
}

export function contestDestination(
  context: ParticipantContext | null,
): string | null {
  if (!context || !context.participant) return "/join";

  const base = `/e/${context.event.code}`;
  if (context.participant.status === "locked_out") return `${base}/locked`;
  if (context.event.status === "ended") return `${base}/locked`;
  if (context.event.status !== "live") return base;
  return null;
}
