import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { isDomainError } from "@/lib/errors";
import { readContestSession } from "@/lib/participants/gate";
import { loadParticipantContext } from "@/lib/participants/queries";
import { now as serverNow } from "@/lib/time";
import { logViolation } from "@/lib/violations/log";
import { recordStrike } from "@/lib/violations/strikes";
import {
  isCountedViolationKind,
  REPORTABLE_VIOLATION_KINDS,
} from "@/lib/violations/kinds";

export const dynamic = "force-dynamic";

/**
 * The endpoint the contest page reports a violation to (SPEC §6). A blocked
 * attempt is logged and costs nothing; leaving fullscreen or losing focus is
 * counted, deduplicated, and — on the third — eliminates.
 *
 * Only kinds the browser can observe are accepted. `duplicate_session` is
 * detected server-side (ticket 14) and is never a client-supplied kind.
 *
 * The participant is resolved through the loader, so the Deadline is
 * reconciled before anything is written, and a violation after it is refused.
 */

const bodySchema = z.object({
  joinCode: z.string().trim().min(1).max(16),
  kind: z.enum(REPORTABLE_VIOLATION_KINDS),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (viewer.kind !== "participant") {
    return Response.json(
      { error: "Only participants have violations." },
      { status: 403 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "That attempt could not be read." },
      { status: 400 },
    );
  }

  const at = serverNow();
  const context = await loadParticipantContext(parsed.joinCode, viewer.user.id, {
    now: at,
  });
  const sessionId = await readContestSession(parsed.joinCode);

  try {
    if (isCountedViolationKind(parsed.kind)) {
      const outcome = await recordStrike(
        context,
        { kind: parsed.kind },
        { now: at, sessionId },
      );
      return Response.json(
        {
          counted: outcome.counted,
          strikes: outcome.strikes,
          eliminated: outcome.eliminated,
          participantStatus: outcome.status,
        },
        { status: 201 },
      );
    }

    await logViolation(context, { kind: parsed.kind }, { now: at, sessionId });
    return Response.json(
      {
        counted: false,
        strikes: context?.participant?.strikes ?? 0,
        eliminated: false,
        participantStatus: context?.participant?.status,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json(
      { error: "That attempt was not recorded." },
      { status: 500 },
    );
  }
}
