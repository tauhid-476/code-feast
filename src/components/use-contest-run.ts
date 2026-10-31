"use client";

import { useCallback, useRef, useState } from "react";
import type { Language } from "@/lib/languages";
import { CONTEST_SESSION_HEADER } from "@/lib/participants/session";
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
  sessionId,
  onLocked,
  onSessionRefused,
  onResult,
}: {
  joinCode: string;
  /** This tab's session, sent with the Run; a displaced tab is refused. */
  sessionId: string;
  /** A 409 means the contest is no longer this view: refresh into the right one. */
  onLocked?: () => void;
  /** A 409 for `session_superseded`: another tab took over, explain it in place. */
  onSessionRefused?: () => void;
  /** Called when a valid run result is received. */
  onResult?: (result: RunResult, problemId: string) => void;
}) {
  const [state, setState] = useState<ContestRunState>({
    running: false,
    result: null,
    error: null,
  });
  const inFlight = useRef(false);
  const bufferVersion = useRef(0);

  const run = useCallback(
    async (input: StartRunInput): Promise<RunResult | null> => {
      if (inFlight.current) return null;
      inFlight.current = true;

      // The verdict belongs to the code that was sent. If the buffer moves on
      // while the Run is open, its result is stale and is discarded.
      const version = bufferVersion.current;
      setState({ running: true, result: null, error: null });

      try {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [CONTEST_SESSION_HEADER]: sessionId,
          },
          signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
          body: JSON.stringify({ joinCode, ...input }),
        });
        const body = (await response.json().catch(() => null)) as
          | { result?: RunResult; error?: string; code?: string }
          | null;

        if (response.status === 409) {
          if (body?.code === "session_superseded" && onSessionRefused) {
            onSessionRefused();
          } else {
            onLocked?.();
          }
        }

        if (!response.ok || !body?.result) {
          setState({
            running: false,
            result: null,
            error:
              body?.error ?? "The Run did not start. Try again in a moment.",
          });
          return null;
        }

        const stale = bufferVersion.current !== version;
        const validResult = stale ? null : body.result;
        setState({
          running: false,
          result: validResult,
          error: null,
        });

        if (validResult && onResult) {
          onResult(validResult, input.problemId);
        }
        return validResult;
      } catch {
        setState({
          running: false,
          result: null,
          error: "The runner could not be reached. Try again in a moment.",
        });
        return null;
      } finally {
        inFlight.current = false;
      }
    },
    [joinCode, sessionId, onLocked, onSessionRefused, onResult],
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
