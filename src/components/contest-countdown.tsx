"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  anchorClock,
  projectNow,
  projectRemainingSeconds,
  type ClockAnchor,
} from "@/lib/contest/clock";
import { formatDuration } from "@/lib/time";

const POLL_MS = 10_000;

type PollBody = {
  serverNow: string;
  deadlineAt: string | null;
  eventStatus: string;
  participantStatus: string;
};

/**
 * The contest's countdown: `deadline_at - serverNow`, corrected for skew and
 * re-derived on every poll (ADR 0002). The anchor is server time paired with
 * the monotonic clock, so changing the system clock changes nothing. When it
 * reaches zero it asks the server for one refresh, which reconciles the lockout
 * and swaps the page for the terminal screen.
 */
export function ContestCountdown({
  code,
  serverNow,
  deadlineAt,
}: {
  code: string;
  serverNow: string;
  deadlineAt: string | null;
}) {
  const router = useRouter();
  const anchorRef = useRef<ClockAnchor>(anchorClock(serverNow, 0));
  const deadlineRef = useRef<string | null>(deadlineAt);
  const refreshedRef = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(() =>
    projectRemainingSeconds(deadlineAt, Date.parse(serverNow)),
  );

  // Anchor to the monotonic clock once mounted, then tick from the projection.
  useEffect(() => {
    anchorRef.current = anchorClock(Date.parse(serverNow), performance.now());
    deadlineRef.current = deadlineAt;

    const tick = () => {
      setRemaining(
        projectRemainingSeconds(
          deadlineRef.current,
          projectNow(anchorRef.current, performance.now()),
        ),
      );
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [serverNow, deadlineAt]);

  useEffect(() => {
    if (remaining !== 0 || refreshedRef.current) return;
    refreshedRef.current = true;
    router.refresh();
  }, [remaining, router]);

  // Re-anchor from the server each poll; if the event is no longer live or the
  // participant is locked, let the server route to the right screen.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/clock?code=${encodeURIComponent(code)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) router.refresh();
          return;
        }

        const body = (await response.json()) as PollBody;
        if (cancelled) return;

        if (body.eventStatus !== "live" || body.participantStatus === "locked_out") {
          router.refresh();
          return;
        }

        anchorRef.current = anchorClock(body.serverNow, performance.now());
        deadlineRef.current = body.deadlineAt;
        setRemaining(
          projectRemainingSeconds(
            body.deadlineAt,
            projectNow(anchorRef.current, performance.now()),
          ),
        );
      } catch {
        // Offline: the monotonic projection keeps running. The autosave banner
        // is what reports the connection, not the clock.
      }
    };

    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [code, router]);

  if (remaining === null) {
    return <span className="mono text-xs text-muted-foreground tabular-nums">—</span>;
  }

  const urgent = remaining <= 5 * 60;

  return (
    <span
      role="timer"
      aria-label="Time remaining"
      className={
        urgent
          ? "mono text-xs font-mono font-semibold tabular-nums text-destructive"
          : "mono text-xs font-mono font-semibold tabular-nums text-foreground"
      }
    >
      {formatDuration(remaining)}
    </span>
  );
}
