import "server-only";

import { auth } from "./server";
import { isOrganizerEmail } from "@/lib/env";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * The session user, or null. Never throws on an anonymous request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split("@")[0],
  };
}

export type Viewer =
  | { kind: "anonymous" }
  | { kind: "organizer"; user: SessionUser }
  | { kind: "participant"; user: SessionUser };

export async function getViewer(): Promise<Viewer> {
  const user = await getSessionUser();
  if (!user) return { kind: "anonymous" };
  return isOrganizerEmail(user.email)
    ? { kind: "organizer", user }
    : { kind: "participant", user };
}

export function landingFor(viewer: Viewer): string {
  switch (viewer.kind) {
    case "organizer":
      return "/admin/events";
    case "participant":
      return "/join";
    default:
      return "/sign-in";
  }
}
