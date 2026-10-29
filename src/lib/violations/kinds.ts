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

/** Counted — one strike each (SPEC §6). */
export const COUNTED_VIOLATION_KINDS = [
  "fullscreen_exit",
  "focus_lost",
  "duplicate_session",
] as const;

export type CountedViolationKind = (typeof COUNTED_VIOLATION_KINDS)[number];

/**
 * What a tab can report for itself. `duplicate_session` is detected
 * server-side (ticket 14), so it is never a client-supplied kind.
 */
export const REPORTABLE_VIOLATION_KINDS = [
  ...UNCOUNTED_VIOLATION_KINDS,
  "fullscreen_exit",
  "focus_lost",
] as const;

export type ReportableViolationKind =
  (typeof REPORTABLE_VIOLATION_KINDS)[number];

/** Three strikes eliminate (SPEC §6, ADR 0004). */
export const STRIKE_LIMIT = 3;

/**
 * One alt-tab fires `blur` and `fullscreenchange` together; signals inside this
 * window are one strike, not two.
 */
export const STRIKE_DEDUPE_MS = 2_000;

export function isUncountedViolationKind(
  kind: ViolationKind,
): kind is UncountedViolationKind {
  return (UNCOUNTED_VIOLATION_KINDS as readonly ViolationKind[]).includes(kind);
}

export function isCountedViolationKind(
  kind: ViolationKind,
): kind is CountedViolationKind {
  return (COUNTED_VIOLATION_KINDS as readonly ViolationKind[]).includes(kind);
}
