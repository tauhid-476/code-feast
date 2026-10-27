export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type Viewer =
  | { kind: "anonymous" }
  | { kind: "organizer"; user: SessionUser }
  | { kind: "participant"; user: SessionUser };

/** Where a viewer belongs when they land on `/`. */
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
