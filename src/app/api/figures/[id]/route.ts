import { getViewer } from "@/lib/auth/session";
import { canReadFigure } from "@/lib/figures/queries";
import { defaultFigureStorage } from "@/lib/figures/storage";

export const dynamic = "force-dynamic";

function notFound(): Response {
  return new Response(null, { status: 404 });
}

/**
 * Streams a Figure (SPEC §9). Authorization is per request and answered with
 * 404 — never 403 — so the route does not confirm that a Figure exists.
 *
 * The fullscreen gate cookie is deliberately not checked: that gate protects
 * the contest surface, not the pixels.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const viewer = await getViewer();
  const actor =
    viewer.kind === "anonymous"
      ? null
      : { id: viewer.user.id, email: viewer.user.email };

  const figure = await canReadFigure(actor, id);
  if (!figure) return notFound();

  const storage = defaultFigureStorage();
  if (!storage) return notFound();

  const object = await storage.read(figure.storageKey);
  if (!object) return notFound();

  const bytes = object.body;
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": figure.contentType,
      "Content-Length": String(object.bytes),
      // An id never changes its bytes, so the browser can keep it for the
      // session; `private` keeps it out of any shared cache.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
