import { getViewer } from "@/lib/auth/session";
import { isDomainError } from "@/lib/errors";
import { confirmFigure } from "@/lib/figures/manage";

export const dynamic = "force-dynamic";

/**
 * Confirms an uploaded object and flips its row to `ready`. The object is
 * checked with a HEAD before the Figure can be referenced from a statement.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;

  try {
    const figure = await confirmFigure(
      { id: viewer.user.id, email: viewer.user.email },
      id,
    );
    return Response.json({
      id: figure.id,
      width: figure.width,
      height: figure.height,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error(error);
    return Response.json(
      { error: "The upload could not be confirmed. Try again." },
      { status: 500 },
    );
  }
}
