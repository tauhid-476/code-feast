"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/time";

/**
 * A projection of server time, not a clock of its own. The starting value
 * comes from the server render and the tick is measured with the monotonic
 * performance clock, so a tampered system clock cannot change it. When it
 * reaches zero it asks for one refresh, which reconciles the roster at the
 * deadline on the server and swaps this for "Deadline reached".
 */
export function EventCountdown({ seconds }: { seconds: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (seconds <= 0) return;

    const startedAt = performance.now();
    let refreshed = false;

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - startedAt) / 1000);
      const remaining = Math.max(0, seconds - elapsed);
      if (ref.current) ref.current.textContent = formatDuration(remaining);

      if (remaining === 0) {
        window.clearInterval(timer);
        if (!refreshed) {
          refreshed = true;
          router.refresh();
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [seconds, router]);

  return (
    <span ref={ref} className="mono text-2xl tabular text-primary">
      {formatDuration(seconds)}
    </span>
  );
}
