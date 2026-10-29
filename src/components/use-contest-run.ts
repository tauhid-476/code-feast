"use client";

import { useCallback, useRef, useState } from "react";
import type { Language } from "@/lib/languages";
import type { RunResult } from "@/lib/runner/run";

/** A Run can wait 20s for a sandbox, compile for 15s, and run two samples. */
const RUN_TIMEOUT_MS = 60_000;

export type ContestRunState = {
  running: boolean;
  result: RunResult | null;
  error: string | null;
};

export type StartRunInput = {
  problemId: string;
  language: Language;
  /** The editor's current content, sent with the Run and never stored. */
  code: string;
};

/**
 * The Participant's Run (SPEC §5.6). It is a request, not a save: the code goes
 * out with the Run and the response is feedback, so a Run can never become a
 * Submission. The 2s interval and the single in-flight Run are the server's
 * rules; the button merely does not send a second request while one is open.
 */
export function useContestRun({
  joinCode,
  onLocked,
}: {
  joinCode: string;
  /** A 409 means the contest is no longer this view: refresh into the right one. */
  onLocked?: () => void;
}) {
  const [state, setState] = useState<ContestRunState>({
    running: false,
    result: null,
    error: null,
  });
  const inFlight = useRef(false);
  const bufferVersion = useRef(0);

  const run = useCallback(
    async (input: StartRunInput) => {
      if (inFlight.current) return;
      inFlight.current = true;

      // The verdict belongs to the code that was sent. If the buffer moves on
      // while the Run is open, its result is stale and is discarded.
      const version = bufferVersion.current;
      setState({ running: true, result: null, error: null });

      try {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
          body: JSON.stringify({ joinCode, ...input }),
        });
        const body = (await response.json().catch(() => null)) as
          | { result?: RunResult; error?: string }
          | null;

        if (response.status === 409) onLocked?.();

        if (!response.ok || !body?.result) {
          setState({
            running: false,
            result: null,
            error:
              body?.error ?? "The Run did not start. Try again in a moment.",
          });
          return;
        }

        const stale = bufferVersion.current !== version;
        setState({
          running: false,
          result: stale ? null : body.result,
          error: null,
        });
      } catch {
        setState({
          running: false,
          result: null,
          error: "The runner could not be reached. Try again in a moment.",
        });
      } finally {
        inFlight.current = false;
      }
    },
    [joinCode, onLocked],
  );

  /** Discards a verdict as soon as the code it describes changes. */
  const clear = useCallback(() => {
    bufferVersion.current += 1;
    setState((previous) =>
      previous.result || previous.error
        ? { running: previous.running, result: null, error: null }
        : previous,
    );
  }, []);

  return { ...state, run, clear };
}
