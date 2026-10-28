"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "@/lib/languages";
import type { ContestDraftView, ContestProblemView } from "./contest-types";
import { chooseDraft, draftKey, type DraftSnapshot } from "@/lib/drafts/merge";
import {
  readLocalDraft,
  storageKey,
  writeLocalDraft,
} from "@/lib/drafts/storage";
import { anchorClock, projectNow, type ClockAnchor } from "@/lib/contest/clock";

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
  serverNow,
}: {
  code: string;
  participantId: string;
  problems: ContestProblemView[];
  drafts: ContestDraftView[];
  serverNow: string;
}) {
  const clockRef = useRef<ClockAnchor>(anchorClock(serverNow, 0));
  const buffersRef = useRef<Record<string, ContestBuffer>>({});
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlightRef = useRef(new Set<string>());
  const hydratedRef = useRef(false);

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

  async function persist(key: string) {
    const buffer = buffersRef.current[key];
    if (!buffer?.pendingSave) return;
    if (inFlightRef.current.has(key)) return;

    const { problemId, language } = splitKey(key);
    const sentCode = buffer.code;

    inFlightRef.current.add(key);
    setSaveState(key, "saving");
    let acknowledged = false;

    try {
      const response = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          joinCode: code,
          problemId,
          language,
          code: sentCode,
        }),
      });

      if (!response.ok) throw new Error(`draft save failed: ${response.status}`);

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
          headers: { "Content-Type": "application/json" },
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
  }, [code]);

  const states = Object.values(saveStates);
  const dirtyCount = Object.values(buffers).filter(
    (buffer) => buffer.pendingSave,
  ).length;

  return {
    hydrated,
    buffers,
    updateCode,
    retryAll,
    dirtyCount,
    saving: states.includes("saving"),
    failed: states.includes("error"),
    saved: states.includes("saved"),
  };
}
