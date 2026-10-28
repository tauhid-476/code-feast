import { getViewer } from "@/lib/auth/session";
import { now as serverNow } from "@/lib/time";
import { loadParticipantContext } from "@/lib/participants/queries";

export const dynamic = "force-dynamic";

/**
 * The contest countdown's poll. It answers with the server's own clock so the
 * client can re-anchor its projection (ADR 0002); nothing here trusts a client
 * time. Loading the participant also reconciles the deadline, so the first poll
 * after it passes reports the lockout and the page swaps to the terminal
 * screen.
 *
 * Ticket 13's heartbeat will carry the same server time alongside the
 * fullscreen/visibility report; this route stays a read-only clock.
 */
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (viewer.kind !== "participant") {
    return Response.json(
      { error: "Only participants have a contest clock." },
      { status: 403 },
    );
  }

  const code = new URL(request.url).searchParams.get("code") ?? "";
  const at = serverNow();
  const context = await loadParticipantContext(code, viewer.user.id, {
    now: at,
  });
  if (!context || !context.participant) {
    return Response.json({ error: "No entry found." }, { status: 404 });
  }

  return Response.json({
    serverNow: at.toISOString(),
    deadlineAt: context.event.deadlineAt?.toISOString() ?? null,
    eventStatus: context.event.status,
    participantStatus: context.participant.status,
  });
}
