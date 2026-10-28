"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * The lobby has nothing to push, so it asks the server again on a slow tick
 * while the event is still a draft. The moment Start commits, the next poll
 * re-renders the page and the gate replaces the waiting card. It is invisible
 * and stops as soon as the gate is shown.
 */
export function LobbyLiveWatcher() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}
