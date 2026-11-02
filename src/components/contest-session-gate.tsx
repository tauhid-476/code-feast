"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  contestSessionAction,
  type ContestSessionResult,
} from "@/app/e/[code]/actions";
import { ContestWorkspace } from "@/components/contest-workspace";
import { SessionTakeover } from "@/components/session-takeover";
import { SignOutButton } from "@/components/sign-out-button";
import type {
  ContestDraftView,
  ContestProblemView,
} from "@/components/contest-types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/legacy-ui/alert";
import { Button } from "@/components/legacy-ui/button";
import { Spinner } from "@/components/legacy-ui/spinner";

/**
 * The tab's session, before the editor exists (SPEC §6, ticket 14).
 *
 * A session belongs to one browser tab, so the id lives in `sessionStorage`:
 * a refresh keeps it, a new tab starts without one. The server mints the id the
 * first time a tab asks, and the tab stores it; from then on the id rides on
 * every contest write and is what the server compares `active_session_id`
 * against.
 *
 * The screen exists because a server render cannot see `sessionStorage`. The
 * page renders this gate, the gate asks the server, and only a tab the server
 * confirms as active gets the workspace. A tab that lost the contest gets the
 * explanation instead, without a strike for merely reloading: an id is verified,
 * never re-claimed.
 */

type SessionState =
  | { kind: "opening" }
  | { kind: "error"; message: string }
  | { kind: "superseded" }
  | { kind: "active"; sessionId: string; strikes: number };

/** One key per event: a tab can hold contests for more than one event. */
function sessionStorageKey(code: string): string {
  return `cf_session_${code.trim().toUpperCase()}`;
}

/**
 * `sessionStorage` can throw — Safari private mode, storage disabled, a
 * sandboxed frame. The in-memory copy keeps this tab working for its lifetime;
 * only a refresh would lose it, and the server would then mint a fresh session.
 */
const memory = new Map<string, string>();

function readSessionId(code: string): string | null {
  const key = sessionStorageKey(code);
  const fallback = memory.get(key) ?? null;
  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSessionId(code: string, sessionId: string): void {
  const key = sessionStorageKey(code);
  memory.set(key, sessionId);
  try {
    window.sessionStorage.setItem(key, sessionId);
  } catch {
    // The memory copy above already holds it.
  }
}

/**
 * One claim per tab, however many times the effect runs. React runs mount
 * effects twice in development, and two claims from one tab would mint two
 * sessions: the second taking over from the first and charging a strike for a
 * tab that only just opened. The map lives for one page load, which is exactly
 * one tab.
 */
const claims = new Map<string, Promise<ContestSessionResult>>();

function claim(
  code: string,
  sessionId: string | null,
): Promise<ContestSessionResult> {
  const key = `${code}\u0000${sessionId ?? "mint"}`;
  const existing = claims.get(key);
  if (existing) return existing;

  const request = contestSessionAction(code, sessionId).then(
    (result) => {
      // A refusal is worth another attempt; a verified session is not.
      if ("error" in result) claims.delete(key);
      return result;
    },
    (error: unknown) => {
      claims.delete(key);
      throw error;
    },
  );
  claims.set(key, request);
  return request;
}

export function ContestSessionGate({
  code,
  eventTitle,
  participantId,
  participantName,
  problems,
  drafts,
  serverNow,
  deadlineAt,
}: {
  code: string;
  eventTitle: string;
  participantId: string;
  participantName: string;
  problems: ContestProblemView[];
  drafts: ContestDraftView[];
  serverNow: string;
  deadlineAt: string | null;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SessionState>({ kind: "opening" });

  useEffect(() => {
    let cancelled = false;

    claim(code, readSessionId(code))
      .then((result) => {
        if (cancelled) return;

        if ("href" in result) {
          router.replace(result.href);
          return;
        }
        if ("error" in result) {
          setState({ kind: "error", message: result.error });
          return;
        }

        writeSessionId(code, result.sessionId);
        setState(
          result.active
            ? {
                kind: "active",
                sessionId: result.sessionId,
                strikes: result.strikes,
              }
            : { kind: "superseded" },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            "The contest could not be opened. Check your connection, then try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, code, router]);

  /** A write refused for `session_superseded` lands here, without a refresh. */
  const refuse = useCallback(() => setState({ kind: "superseded" }), []);

  if (state.kind === "opening") {
    return (
      <main className="flex h-dvh items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Opening your work
      </main>
    );
  }

  if (state.kind === "superseded") {
    return (
      <SessionTakeover
        eventTitle={eventTitle}
        participantName={participantName}
        action={<SignOutButton />}
      />
    );
  }

  if (state.kind === "error") {
    return (
      <main className="flex h-dvh items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Alert variant="destructive">
            <AlertTitle>Contest not opened</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setState({ kind: "opening" });
                setAttempt((count) => count + 1);
              }}
            >
              Try again
            </Button>
            <SignOutButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <ContestWorkspace
      code={code}
      eventTitle={eventTitle}
      participantId={participantId}
      participantName={participantName}
      problems={problems}
      drafts={drafts}
      sessionId={state.sessionId}
      strikes={state.strikes}
      serverNow={serverNow}
      deadlineAt={deadlineAt}
      onSessionRefused={refuse}
    />
  );
}
