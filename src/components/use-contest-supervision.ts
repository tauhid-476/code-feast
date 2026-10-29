"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  blockedMessage,
  shouldCountStrike,
  shouldReportAttempt,
} from "@/lib/contest/anti-cheat";
import { strikeMessage } from "@/lib/contest/copy";
import {
  HEARTBEAT_INTERVAL_MS,
  heartbeatReport,
} from "@/lib/contest/heartbeat";
import {
  isCountedViolationKind,
  STRIKE_LIMIT,
  type ViolationKind,
} from "@/lib/violations/kinds";

/**
 * The contest page's supervision (SPEC §6): the fullscreen and focus events
 * that report themselves, and the five-second heartbeat that reports state
 * even when they are suppressed. Both feed the same counter; the server is the
 * authority for every number here.
 *
 * The client dedupe is only about not sending the same gesture twice — an
 * alt-tab fires `blur`, `visibilitychange`, and `fullscreenchange` together.
 * The server repeats the check across requests, so two requests for one event
 * still cost one strike.
 */

function subscribeToFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

function isFullscreen() {
  return document.fullscreenElement !== null;
}

type Reported = {
  counted?: boolean;
  strikes?: number;
  eliminated?: boolean;
  participantStatus?: string;
};

export type ContestSupervision = {
  strikes: number;
  report: (kind: ViolationKind) => void;
  /** True while the document is not fullscreen, so the page can offer a way back. */
  outOfFullscreen: boolean;
  /** Re-request fullscreen from a click; the browser requires the gesture. */
  enterFullscreen: () => void;
};

export function useContestSupervision({
  code,
  initialStrikes,
}: {
  code: string;
  initialStrikes: number;
}): ContestSupervision {
  const [strikes, setStrikes] = useState(initialStrikes);
  // The browser's own state, not a copy: a refresh that left fullscreen behind
  // is visible on the first client render without a hydration mismatch.
  const fullscreen = useSyncExternalStore(
    subscribeToFullscreen,
    isFullscreen,
    () => true,
  );
  const router = useRouter();
  const codeRef = useRef(code);
  const lastReportedAt = useRef(new Map<ViolationKind, number>());
  const lastStrikeAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const apply = useCallback(
    (body: Reported) => {
      if (typeof body.strikes === "number") setStrikes(body.strikes);
      // A beat that eliminates is the only way a suppressed page learns about
      // it; the refresh reconciles the lockout and lands on the terminal screen.
      if (body.eliminated || body.participantStatus === "locked_out") {
        router.refresh();
      }
    },
    [router],
  );

  const report = useCallback(
    (kind: ViolationKind) => {
      // Ordering only; the server owns the strike timestamps.
      const at = Date.now();
      if (isCountedViolationKind(kind)) {
        if (!shouldCountStrike(lastStrikeAt.current, at)) return;
        lastStrikeAt.current = at;
      } else {
        if (!shouldReportAttempt(lastReportedAt.current.get(kind), at)) return;
        lastReportedAt.current.set(kind, at);
      }

      const message = blockedMessage(kind);
      if (message) toast(message);

      void fetch("/api/violation", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: codeRef.current, kind }),
      })
        .then(async (response) => {
          if (!response.ok) {
            if ([401, 403, 404, 409].includes(response.status)) router.refresh();
            return;
          }
          const body = (await response.json()) as Reported;
          if (body.counted && typeof body.strikes === "number") {
            toast.warning(strikeMessage(body.strikes, STRIKE_LIMIT));
          }
          apply(body);
        })
        .catch(() => {
          // Nothing to repair: the attempt is already prevented, and the next
          // heartbeat reports the same state to the server.
        });
    },
    [apply, router],
  );

  const enterFullscreen = useCallback(() => {
    if (document.fullscreenElement) return;
    void document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .catch(() => {
        // The browser refused; the notice stays and the next click retries.
      });
  }, []);

  // The page's own report. `blur` and `visibilitychange` both mean focus lost;
  // the server's two-second window is what stops them costing two strikes.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement === null) report("fullscreen_exit");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") report("focus_lost");
    };
    const onBlur = () => report("focus_lost");

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [report]);

  // The beat that makes suppressing the listeners pointless. No beat is sent
  // at mount: the page has just been granted fullscreen by a user gesture, and
  // a state captured mid-transition must not invent an exit.
  useEffect(() => {
    let cancelled = false;

    const beat = async () => {
      try {
        const response = await fetch("/api/heartbeat", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            joinCode: codeRef.current,
            ...heartbeatReport(
              document.fullscreenElement,
              document.visibilityState,
            ),
          }),
        });
        if (!response.ok) {
          if ([401, 403, 404, 409].includes(response.status)) router.refresh();
          return;
        }
        const body = (await response.json()) as Reported;
        if (cancelled) return;
        apply(body);
      } catch {
        // Offline: the page's own listeners still report, and reconnecting
        // resumes the beat. The autosave banner reports the connection.
      }
    };

    const timer = window.setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apply, router]);

  return { strikes, report, outOfFullscreen: !fullscreen, enterFullscreen };
}
