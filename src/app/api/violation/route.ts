import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { isDomainError } from "@/lib/errors";
import { loadParticipantContext } from "@/lib/participants/queries";
import { logViolation } from "@/lib/violations/log";
import { UNCOUNTED_VIOLATION_KINDS } from "@/lib/violations/kinds";

export const dynamic = "force-dynamic";

/**
 * The endpoint the editor guards call for a blocked gesture (SPEC §6). Only the
 * uncounted kinds are accepted here: ticket 13 owns counted strikes and the
 * heartbeat, and a blocked attempt must never cost a strike.
 *
 * The participant is resolved through the loader, so an attempt after the
 * deadline is refused rather than recorded against a locked contest.
 */

const bodySchema = z.object({
  joinCode: z.string().trim().min(1).max(16),
  kind: z.enum(UNCOUNTED_VIOLATION_KINDS),
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

  const context = await loadParticipantContext(parsed.joinCode, viewer.user.id);

  try {
    const violation = await logViolation(context, {
      kind: parsed.kind,
      counted: false,
    });
    return Response.json(
      { createdAt: violation.createdAt.toISOString() },
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
