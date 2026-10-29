import { after } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { runFromContest } from "@/lib/contest/run";
import { isDomainError } from "@/lib/errors";
import { LANGUAGES } from "@/lib/languages";
import { readContestSession } from "@/lib/participants/gate";
import { loadParticipantContext } from "@/lib/participants/queries";
import { scheduleReplenish } from "@/lib/runner/pool";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  joinCode: z.string().trim().min(1).max(16),
  problemId: z.uuid(),
  language: z.enum(LANGUAGES),
  code: z.string().max(200_000),
});

/**
 * The Participant's Run (SPEC §9 names `/api/run`). Identity and role are
 * decided here; the deadline reconciliation comes from the participant loader;
 * the Run itself is `runFromContest`.
 *
 * A Run is feedback only, so nothing is written. The only durable effect is the
 * rate-limit slot, which lives in Postgres because several serverless instances
 * serve the same event.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (viewer.kind !== "participant") {
    return Response.json(
      { error: "Only participants run code in a contest." },
      { status: 403 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "That Run could not be read." },
      { status: 400 },
    );
  }

  const context = await loadParticipantContext(parsed.joinCode, viewer.user.id);
  // The browser session running, from its cookie; a displaced tab is refused.
  const sessionId = await readContestSession(parsed.joinCode);

  try {
    const result = await runFromContest(
      context,
      {
        problemId: parsed.problemId,
        language: parsed.language,
        code: parsed.code,
      },
      { sessionId },
    );
    return Response.json({ result });
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json(
      { error: "The Run failed. Try again in a moment." },
      { status: 500 },
    );
  } finally {
    // SPEC §7: a request that finds the pool short tops it up off the response.
    // Safe on every outcome — replenish is a no-op when the pool is already full.
    after(scheduleReplenish());
  }
}
