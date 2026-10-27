import "server-only";

import { forbidden, unauthorized } from "next/navigation";
import { getViewer, type SessionUser } from "./session";

/**
 * Authorization for organizer surfaces. A proxy redirect only catches
 * anonymous visitors; this is the check that actually decides.
 */
export async function requireOrganizer(): Promise<SessionUser> {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") unauthorized();
  if (viewer.kind !== "organizer") forbidden();
  return viewer.user;
}

export async function requireParticipant(): Promise<SessionUser> {
  const viewer = await getViewer();
  if (viewer.kind === "anonymous") unauthorized();
  if (viewer.kind !== "participant") forbidden();
  return viewer.user;
}
