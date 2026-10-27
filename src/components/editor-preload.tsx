"use client";

import { useEffect } from "react";

/**
 * Warms the editor bundle while the participant waits in the lobby, so entering
 * the contest does not stall on a download. Renders nothing on purpose.
 */
export function EditorPreload() {
  useEffect(() => {
    let cancelled = false;

    void import("@monaco-editor/react")
      .then(({ loader }) => {
        if (cancelled) return;
        void loader.init().catch(() => {
          // Preloading is an optimisation; a failure must not reach the lobby.
        });
      })
      .catch(() => {
        // Same: the contest view will request the editor itself if this missed.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
