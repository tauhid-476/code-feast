/**
 * The Anti-cheat vocabulary (SPEC §6). Two categories, deliberately separated:
 * a prevented action is logged so the Organizer can see it, but it is not a
 * strike. `counted` is the difference, and it lives on the row so the review
 * screen never has to guess.
 */

export const VIOLATION_KINDS = [
  "fullscreen_exit",
  "focus_lost",
  "duplicate_session",
  "paste_blocked",
  "context_menu_blocked",
] as const;

export type ViolationKind = (typeof VIOLATION_KINDS)[number];

/** Blocked, logged, never counted. */
export const UNCOUNTED_VIOLATION_KINDS = [
  "paste_blocked",
  "context_menu_blocked",
] as const;

export type UncountedViolationKind = (typeof UNCOUNTED_VIOLATION_KINDS)[number];

export function isUncountedViolationKind(
  kind: ViolationKind,
): kind is UncountedViolationKind {
  return (UNCOUNTED_VIOLATION_KINDS as readonly ViolationKind[]).includes(kind);
}
