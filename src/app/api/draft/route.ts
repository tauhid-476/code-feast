import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { saveDraft } from "@/lib/drafts/manage";
import { isDomainError } from "@/lib/errors";
import { LANGUAGES } from "@/lib/languages";
import { loadParticipantContext } from "@/lib/participants/queries";
import { CONTEST_SESSION_HEADER } from "@/lib/participants/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  joinCode: z.string().trim().min(1).max(16),
  problemId: z.uuid(),
  language: z.enum(LANGUAGES),
  code: z.string().max(200_000),
});

/**
 * The autosave endpoint SPEC §9 names. One write per Problem per language; the
 * server owns `updated_at`, and the participant is resolved through the loader
 * so a save after the deadline is refused rather than silently accepted.
 *
 * The response carries the server timestamp the client stores beside its local
 * mirror, which is what the local-versus-server merge compares.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (viewer.kind !== "participant") {
    return Response.json(
      { error: "Only participants save drafts." },
      { status: 403 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "That draft could not be read." },
      { status: 400 },
    );
  }

  const context = await loadParticipantContext(parsed.joinCode, viewer.user.id);
  // The tab this save comes from, from its session header. A displaced tab is
  // refused below; the body never names a session (ticket 14).
  const sessionId = request.headers.get(CONTEST_SESSION_HEADER);

  try {
    const draft = await saveDraft(
      context,
      {
        problemId: parsed.problemId,
        language: parsed.language,
        code: parsed.code,
      },
      { sessionId },
    );
    return Response.json({ updatedAt: draft.updatedAt.toISOString() });
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error(error);
    return Response.json(
      { error: "Your code was not saved. Retrying." },
      { status: 500 },
    );
  }
}
