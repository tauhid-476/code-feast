"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Maximize2 } from "lucide-react";
import { enterContestAction } from "@/app/e/[code]/actions";
import { ContestCountdown } from "@/components/contest-countdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/legacy-ui/alert";
import { Button } from "@/components/legacy-ui/button";
import { Card, CardContent } from "@/components/legacy-ui/card";

/**
 * The Start gate. Browsers only grant fullscreen from a user gesture, so this
 * is the one action that enters the contest: request fullscreen, and only if
 * the browser agrees, ask the server for the gate cookie. A refusal leaves the
 * participant here with an explanation.
 */
export function FullscreenGate({
  code,
  serverNow,
  deadlineAt,
}: {
  code: string;
  serverNow: string;
  deadlineAt: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function enter() {
    setError(null);

    if (!document.fullscreenEnabled) {
      setError(
        "This browser does not allow fullscreen here. Allow fullscreen for this site, then try again.",
      );
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      }
    } catch {
      setError(
        "Your browser refused fullscreen. Allow fullscreen for this site, then try again.",
      );
      return;
    }

    if (!document.fullscreenElement) {
      setError(
        "Fullscreen did not start. Allow fullscreen for this site, then try again.",
      );
      return;
    }

    startTransition(async () => {
      const result = await enterContestAction(code);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Client navigation, not a document load: the fullscreen request would
      // not survive a hard navigation in every browser.
      router.replace(result.href);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="label">Live</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-balance">
            The event has started
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your problems are open. The shared clock is running for everyone.
          </p>
        </div>

        <div className="flex items-baseline justify-between border-y border-border py-3">
          <span className="label">Time remaining</span>
          <ContestCountdown
            code={code}
            serverNow={serverNow}
            deadlineAt={deadlineAt}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          The contest opens in fullscreen. Your work is autosaved from the first
          keystroke.
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Fullscreen is required</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={enter}
        >
          <Maximize2 data-icon="inline-start" />
          {pending ? "Entering…" : "Enter fullscreen"}
        </Button>
      </CardContent>
    </Card>
  );
}
