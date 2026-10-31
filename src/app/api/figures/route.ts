import { after } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { isDomainError } from "@/lib/errors";
import { mintFigure, sweepStalePending } from "@/lib/figures/manage";
import { FIGURE_CONTENT_TYPES } from "@/lib/figures/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  problemId: z.uuid(),
  contentType: z.enum([...FIGURE_CONTENT_TYPES]),
  bytes: z.number().int().positive(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
});

/**
 * Mints a Figure upload (SPEC §9). The sweep of abandoned pendings is handed to
 * `after()` so it never delays the mint itself.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (viewer.kind !== "organizer") {
    return Response.json(
      { error: "Only an organizer can add a figure." },
      { status: 403 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: "That figure upload could not be read." },
      { status: 400 },
    );
  }

  after(async () => {
    try {
      await sweepStalePending();
    } catch (error) {
      console.error("[figures] stale pending sweep failed", error);
    }
  });

  try {
    const minted = await mintFigure(
      { id: viewer.user.id, email: viewer.user.email },
      parsed,
    );
    return Response.json(minted);
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error(error);
    return Response.json(
      { error: "The figure could not be uploaded. Try again." },
      { status: 500 },
    );
  }
}
