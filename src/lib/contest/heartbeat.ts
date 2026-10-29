import type { CountedViolationKind } from "@/lib/violations/kinds";

/**
 * What the contest page reports about itself every five seconds (SPEC §6). The
 * heartbeat is the enforcement that does not depend on the page's event
 * listeners: a participant who suppresses them is still caught server-side.
 */

export const HEARTBEAT_INTERVAL_MS = 5_000;

export type PageVisibility = "visible" | "hidden";

export type HeartbeatReport = {
  /** `document.fullscreenElement !== null` at the moment of the beat. */
  fullscreen: boolean;
  /** `document.visibilityState` at the moment of the beat. */
  visibilityState: PageVisibility;
  /**
   * Whether this session crossed the fullscreen gate. A typed URL is not an
   * exit; only a session that entered can leave.
   */
  entered: boolean;
};

/** The wire shape from the browser, without the gate the server decides. */
export function heartbeatReport(
  fullscreenElement: unknown,
  visibilityState: PageVisibility,
): Pick<HeartbeatReport, "fullscreen" | "visibilityState"> {
  return {
    fullscreen: fullscreenElement !== null && fullscreenElement !== undefined,
    visibilityState,
  };
}

/**
 * The violations a beat reports, most severe first. Both can be wrong at once
 * (an alt-tab leaves fullscreen and hides the page); the server's dedupe window
 * turns them into the one strike they are.
 */
export function violatingHeartbeatKinds({
  fullscreen,
  visibilityState,
  entered,
}: HeartbeatReport): CountedViolationKind[] {
  const kinds: CountedViolationKind[] = [];
  if (entered && !fullscreen) kinds.push("fullscreen_exit");
  if (visibilityState === "hidden") kinds.push("focus_lost");
  return kinds;
}
