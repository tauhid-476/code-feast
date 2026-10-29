import type { UncountedViolationKind, ViolationKind } from "@/lib/violations/kinds";

/**
 * The gestures SPEC §6 blocks. One mapper answers "is this a blocked attempt,
 * and which one?" for both Monaco events and DOM events, so the installer and
 * its tests agree on what counts.
 */

export const PASTE_BLOCKED_MESSAGE = "Pasting is disabled.";

export type BlockedKind = UncountedViolationKind;

/** The subset of an event the guards look at. */
export type BlockedGesture = {
  type?: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  button?: number;
};

export function blockedKindFor(
  gesture: BlockedGesture,
): BlockedKind | null {
  switch (gesture.type) {
    case "keydown":
      // Ctrl+V and Cmd+V, case-insensitively: Shift+Ctrl+V is still a paste.
      return (gesture.ctrlKey || gesture.metaKey) &&
        gesture.key?.toLowerCase() === "v"
        ? "paste_blocked"
        : null;
    case "paste":
    case "drop":
      return "paste_blocked";
    case "mousedown":
      // Middle click on X11 pastes the primary selection.
      return gesture.button === 1 ? "paste_blocked" : null;
    case "contextmenu":
      return "context_menu_blocked";
    default:
      return null;
  }
}

/** Only a blocked paste earns a toast; a suppressed menu is silent. */
export function blockedMessage(kind: ViolationKind): string | null {
  return kind === "paste_blocked" ? PASTE_BLOCKED_MESSAGE : null;
}

/**
 * One gesture can reach us more than once (Monaco's command plus the DOM
 * `paste` event). Collapsing signals inside a short window keeps one attempt
 * to one toast and one row without dropping a deliberate second attempt.
 */
export function shouldReportAttempt(
  previousAt: number | undefined,
  now: number,
  windowMs = 250,
): boolean {
  return previousAt === undefined || now - previousAt >= windowMs;
}
