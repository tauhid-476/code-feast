import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { isDomainError } from "@/lib/errors";
import { readContestGate } from "@/lib/participants/gate";
import { loadParticipantContext } from "@/lib/participants/queries";
import { now as serverNow } from "@/lib/time";
import { recordHeartbeat } from "@/lib/violations/heartbeat";

export const dynamic = "force-dynamic";

/**
 * The five-second heartbeat (SPEC §6). The contest page reports
 * `document.fullscreenElement` and `document.visibilityState`; a violation the
 * client did not report is counted here, which is what makes suppressing the
 * page's listeners ineffective.
 *
 * The gate cookie decides whether a missing fullscreen element is an exit: a
 * session that never crossed the gate has nothing to leave.
 *
 * The response carries the new strike count, so the page can route to the
 * terminal screen the moment a beat eliminates. The countdown keeps its own
 * read-only `/api/clock` poll: a lost heartbeat must never freeze the display.
 */

const bodySchema = z.object({
  joinCode: z.string().trim().min(1).max(16),
  fullscreen: z.boolean(),
  visibilityState: z.enum(["visible", "hidden"]),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (viewer.kind !== "participant") {
    return Response.json(
      { error: "Only participants have a contest heartbeat." },
      { status: 403 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "That heartbeat could not be read." },
      { status: 400 },
    );
  }

  const at = serverNow();
  const context = await loadParticipantContext(parsed.joinCode, viewer.user.id, {
    now: at,
  });
  if (!context || !context.participant) {
    return Response.json({ error: "No entry found." }, { status: 404 });
  }

  const entered = await readContestGate(
    parsed.joinCode,
    {
      eventId: context.event.id,
      participantId: context.participant.id,
    },
    at,
  );

  try {
    const outcome = await recordHeartbeat(
      context,
      {
        fullscreen: parsed.fullscreen,
        visibilityState: parsed.visibilityState,
        entered,
      },
      { now: at },
    );

    return Response.json({
      strikes: outcome.strikes,
      counted: outcome.counted,
      eliminated: outcome.eliminated,
      participantStatus: outcome.status,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json(
      { error: "That heartbeat was not recorded." },
      { status: 500 },
    );
  }
}
