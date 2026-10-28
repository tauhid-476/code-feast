/**
 * The contest countdown is a projection of server time, not a clock of its own
 * (ADR 0002). The server hands over its own `now`; the client pairs it with the
 * monotonic `performance.now()` and adds elapsed monotonic time. Wall-clock
 * changes — including a tampered system clock — cannot move it, and re-anchoring
 * on each poll corrects drift and absorbs clock skew.
 *
 * Nothing here calls `Date.now()` on purpose: the anchor is the only time
 * input, which is also what makes these functions testable without a browser.
 */

export type ClockAnchor = {
  /** Server time at the moment the anchor was taken, milliseconds. */
  serverNowMs: number;
  /** The matching monotonic reading, milliseconds. */
  monotonicMs: number;
};

export function anchorClock(
  serverNow: Date | string | number,
  monotonicMs: number,
): ClockAnchor {
  const serverNowMs =
    serverNow instanceof Date
      ? serverNow.getTime()
      : typeof serverNow === "number"
        ? serverNow
        : Date.parse(serverNow);

  return { serverNowMs, monotonicMs };
}

/** The server's clock now, estimated from monotonic elapsed time. */
export function projectNow(anchor: ClockAnchor, monotonicMs: number): number {
  return anchor.serverNowMs + (monotonicMs - anchor.monotonicMs);
}

/** Whole seconds left, floored at zero. Null when the event has no deadline. */
export function projectRemainingSeconds(
  deadlineAt: Date | string | null,
  nowMs: number,
): number | null {
  if (!deadlineAt) return null;
  const deadlineMs =
    deadlineAt instanceof Date ? deadlineAt.getTime() : Date.parse(deadlineAt);
  if (!Number.isFinite(deadlineMs)) return null;
  return Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
}
