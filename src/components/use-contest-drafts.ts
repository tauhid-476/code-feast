"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/lib/languages";
import type { ContestDraftView, ContestProblemView } from "./contest-types";
import { chooseDraft, draftKey, type DraftSnapshot } from "@/lib/drafts/merge";
import {
  readLocalDraft,
  storageKey,
  writeLocalDraft,
} from "@/lib/drafts/storage";
import { anchorClock, projectNow, type ClockAnchor } from "@/lib/contest/clock";
import { CONTEST_SESSION_HEADER } from "@/lib/participants/session";

const SAVE_DEBOUNCE_MS = 900;
const RETRY_MS = 400;

/** One editor buffer per Problem per language. */
export type ContestBuffer = {
  code: string;
  /** Milliseconds since the epoch, in the client's projection of server time. */
  updatedAt: number;
  /** True when the server has not acknowledged this code. */
  pendingSave: boolean;
};

export type SaveState = "saving" | "saved" | "error";

function splitKey(key: string): { problemId: string; language: Language } {
  const at = key.lastIndexOf(":");
  return {
    problemId: key.slice(0, at),
    language: key.slice(at + 1) as Language,
  };
}

/**
 * Autosave for the contest. The buffer lives in React so the editor is never
 * driven by it — Monaco keeps its own undo history — and every keystroke is
 * mirrored to localStorage before the debounced request, so a crash or a
 * closed tab loses nothing. A failed request leaves the buffer mirrored and
 * "Not saved" on screen; the next keystroke, the Retry button, or the browser
 * coming back online resends it.
 */
export function useContestDrafts({
  code,
  participantId,
  problems,
  drafts,
  sessionId,
  serverNow,
  onSessionRefused,
}: {
  code: string;
  participantId: string;
  problems: ContestProblemView[];
  drafts: ContestDraftView[];
  /** This tab's session; a displaced tab is refused by the server (ticket 14). */
  sessionId: string;
  serverNow: string;
  onSessionRefused: () => void;
}) {
  const clockRef = useRef<ClockAnchor>(anchorClock(serverNow, 0));
  const buffersRef = useRef<Record<string, ContestBuffer>>({});
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlightRef = useRef(new Map<string, Promise<void>>());
  const hydratedRef = useRef(false);
  const router = useRouter();

  const [buffers, setBuffersState] = useState<Record<string, ContestBuffer>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [hydrated, setHydrated] = useState(false);

  function setBuffers(
    updater: (prev: Record<string, ContestBuffer>) => Record<string, ContestBuffer>,
  ) {
    const next = updater(buffersRef.current);
    buffersRef.current = next;
    setBuffersState(next);
  }

  function setSaveState(key: string, state: SaveState) {
    setSaveStates((prev) => ({ ...prev, [key]: state }));
  }

  /** Keep the projection honest when the server re-renders the page. */
  useEffect(() => {
    clockRef.current = anchorClock(Date.parse(serverNow), performance.now());
  }, [serverNow]);

  // First load: server draft or a newer local mirror, else the Starter Code.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const serverByKey = new Map<string, DraftSnapshot>();
    for (const draft of drafts) {
      serverByKey.set(draftKey(draft.problemId, draft.language), {
        code: draft.code,
        updatedAt: Date.parse(draft.updatedAt),
      });
    }

    const next: Record<string, ContestBuffer> = {};
    for (const problem of problems) {
      const languages =
        problem.starters.length > 0
          ? problem.starters.map((starter) => starter.language)
          : (["python", "java", "cpp"] as Language[]);

      for (const language of languages) {
        const key = draftKey(problem.id, language);
        const starterCode = problem.starters.find(
          (starter) => starter.language === language,
        )?.starterCode;
        const local = readLocalDraft(storageKey(participantId, problem.id, language));
        const choice = chooseDraft(
          serverByKey.get(key) ?? null,
          local,
          starterCode,
        );
        next[key] = {
          code: choice.code,
          updatedAt: choice.updatedAt,
          pendingSave: choice.pendingSave,
        };

        // Keep the mirror in step with an acknowledged server copy so an old
        // local value cannot come back to life later.
        if (choice.source === "server") {
          writeLocalDraft(storageKey(participantId, problem.id, language), {
            code: choice.code,
            updatedAt: choice.updatedAt,
          });
        }
      }
    }

    buffersRef.current = next;
    setBuffersState(next);
    setHydrated(true);
  }, [drafts, participantId, problems]);

  function persist(key: string): Promise<void> {
    const buffer = buffersRef.current[key];
    if (!buffer?.pendingSave) return Promise.resolve();

    // A second click, Retry, or flush joins the request already on the wire
    // instead of sending a duplicate or pretending the save is done.
    const running = inFlightRef.current.get(key);
    if (running) return running;

    const { problemId, language } = splitKey(key);
    const sentCode = buffer.code;

    const request = (async () => {
      setSaveState(key, "saving");
      let acknowledged = false;

      try {
        const response = await fetch("/api/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [CONTEST_SESSION_HEADER]: sessionId,
          },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            joinCode: code,
            problemId,
            language,
            code: sentCode,
          }),
        });

        if (!response.ok) {
          // A session a newer tab displaced (ticket 14) is explained in place;
          // a locked contest is a page change. Either way this view is no
          // longer the contest, so it does not report "Not saved" for code the
          // server will never accept from this window.
          const refusal = (await response.json().catch(() => null)) as {
            code?: string;
          } | null;
          if (refusal?.code === "session_superseded") onSessionRefused();
          else if (response.status === 409) router.refresh();
          throw new Error(`draft save failed: ${response.status}`);
        }

        const body = (await response.json()) as { updatedAt: string };
        const updatedAt = Date.parse(body.updatedAt);
        if (!Number.isFinite(updatedAt)) throw new Error("draft save: bad time");
        acknowledged = true;

        const current = buffersRef.current[key];
        if (current?.code === sentCode) {
          setBuffers((prev) => ({
            ...prev,
            [key]: { code: sentCode, updatedAt, pendingSave: false },
          }));
          writeLocalDraft(storageKey(participantId, problemId, language), {
            code: sentCode,
            updatedAt,
          });
          setSaveState(key, "saved");
        }
      } catch {
        // Leave the buffer pending. The banner, the Retry button, the next
        // keystroke, and the browser coming back online all resend it; a failed
        // request never retries in a tight loop.
        setSaveState(key, "error");
      } finally {
        inFlightRef.current.delete(key);
        // Only a save that reached the server is worth an immediate follow-up;
        // that follow-up carries keystrokes made while the request was in flight.
        if (acknowledged && buffersRef.current[key]?.pendingSave) {
          schedule(key, RETRY_MS);
        }
      }
    })();

    inFlightRef.current.set(key, request);
    return request;
  }

  function schedule(key: string, delay = SAVE_DEBOUNCE_MS) {
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    timersRef.current.set(
      key,
      setTimeout(() => {
        timersRef.current.delete(key);
        void persist(key);
      }, delay),
    );
  }

  function updateCode(key: string, editorCode: string) {
    // Strictly increasing per buffer: a keystroke that lands within the same
    // millisecond as an acknowledged save must still look newer than it.
    const previous = buffersRef.current[key];
    const updatedAt = Math.max(
      projectNow(clockRef.current, performance.now()),
      (previous?.updatedAt ?? 0) + 1,
    );
    setBuffers((prev) => ({
      ...prev,
      [key]: { code: editorCode, updatedAt, pendingSave: true },
    }));

    const { problemId, language } = splitKey(key);
    writeLocalDraft(storageKey(participantId, problemId, language), {
      code: editorCode,
      updatedAt,
    });
    schedule(key);
  }

  function retryAll() {
    for (const [key, buffer] of Object.entries(buffersRef.current)) {
      if (!buffer.pendingSave) continue;
      void persist(key);
    }
  }

  /**
   * Submit freezes what the server has, so every keystroke still waiting on the
   * debounce must reach it first. Returns false when something could not be
   * saved: the Submit is then refused rather than freezing a snapshot that is
   * missing the participant's last lines.
   */
  async function flushAll(): Promise<boolean> {
    const pending = () =>
      Object.keys(buffersRef.current).filter(
        (key) => buffersRef.current[key]?.pendingSave,
      );

    // Two passes: the first sends what is pending now, the second carries
    // keystrokes typed while the first request was on the wire.
    for (let pass = 0; pass < 2; pass += 1) {
      const keys = pending();
      if (keys.length === 0) return true;

      for (const key of keys) {
        const timer = timersRef.current.get(key);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(key);
        }
      }

      await Promise.all(keys.map((key) => persist(key)));
    }

    return pending().length === 0;
  }

  // A local copy newer than the server is resynced once the workspace opens.
  const hydratedOnceRef = useRef(false);
  useEffect(() => {
    if (!hydrated || hydratedOnceRef.current) return;
    hydratedOnceRef.current = true;
    for (const [key, buffer] of Object.entries(buffersRef.current)) {
      if (buffer.pendingSave) schedule(key, SAVE_DEBOUNCE_MS * 2);
    }
    // schedule/persist read refs, so running this once is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Reconnect: push everything that is still only local. Closing the tab: send
  // a last best-effort copy so a clean unload does not depend on refresh.
  useEffect(() => {
    const timers = timersRef.current;
    const onOnline = () => retryAll();
    const onPageHide = () => {
      for (const [key, buffer] of Object.entries(buffersRef.current)) {
        if (!buffer.pendingSave) continue;
        const { problemId, language } = splitKey(key);
        void fetch("/api/draft", {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            [CONTEST_SESSION_HEADER]: sessionId,
          },
          body: JSON.stringify({
            joinCode: code,
            problemId,
            language,
            code: buffer.code,
          }),
        }).catch(() => {
          // localStorage already has it; the next visit resyncs.
        });
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, sessionId]);

  const states = Object.values(saveStates);
  const dirtyCount = Object.values(buffers).filter(
    (buffer) => buffer.pendingSave,
  ).length;

  return {
    hydrated,
    buffers,
    updateCode,
    retryAll,
    flushAll,
    dirtyCount,
    saving: states.includes("saving"),
    failed: states.includes("error"),
    saved: states.includes("saved"),
  };
}
