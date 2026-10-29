"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  blockedMessage,
  shouldReportAttempt,
} from "@/lib/contest/anti-cheat";
import type { ViolationKind } from "@/lib/violations/kinds";

/**
 * Turns an editor gesture into the two things SPEC §6 asks for: one toast, and
 * one server-side row. The row is fire-and-forget with `keepalive`, so a
 * refresh or a close does not depend on the participant staying on the page.
 *
 * The dedupe is per kind and in memory: one attempt that reaches us through
 * both Monaco and the DOM is still one attempt, but a second deliberate attempt
 * a moment later is still seen.
 *
 * The returned reporter is stable for the life of the editor, so the guards
 * are installed once and still carry the current Join Code.
 */
export function useAntiCheat({ code }: { code: string }) {
  const lastReportedAt = useRef(new Map<ViolationKind, number>());
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  return useCallback((kind: ViolationKind) => {
    const at = Date.now();
    if (!shouldReportAttempt(lastReportedAt.current.get(kind), at)) return;
    lastReportedAt.current.set(kind, at);

    const message = blockedMessage(kind);
    if (message) toast(message);

    void fetch("/api/violation", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinCode: codeRef.current, kind }),
    }).catch(() => {
      // Nothing to repair: the attempt is already prevented and the toast is
      // the participant-facing part. A lost row is the Organizer's loss, not a
      // reason to interrupt typing.
    });
  }, []);
}
