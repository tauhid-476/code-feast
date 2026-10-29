"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { submitContestAction } from "@/app/e/[code]/actions";
import { submitConfirmationText } from "@/lib/contest/copy";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * The global Submit (SPEC §5.7). The confirmation is a dialog, not a toast,
 * because this is the one action that cannot be undone. Before the write it
 * waits for the autosave to catch up: the Submission is built from the server's
 * drafts, so a keystroke still on the debounce would otherwise be missing.
 */
export function SubmitContest({
  code,
  sessionId,
  flush,
  disabled = false,
  onSessionRefused,
}: {
  code: string;
  /** This tab's session: Submit is refused for a displaced tab (ticket 14). */
  sessionId: string;
  /** Saves whatever is still pending; false means the work is not on the server. */
  flush: () => Promise<boolean>;
  disabled?: boolean;
  /** The Submit was refused because another tab took over: explain it in place. */
  onSessionRefused: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pending) return;
    setPending(true);
    setError(null);

    const flushed = await flush();
    if (!flushed) {
      setPending(false);
      setError(
        "Your latest changes are not saved yet. Check your connection, then submit again.",
      );
      return;
    }

    const result = await submitContestAction(code, sessionId);
    if ("error" in result) {
      setPending(false);
      // A takeover is not a Submit failure: the dialog is replaced by the
      // explanation of what happened to this tab.
      if (result.code === "session_superseded") {
        setConfirming(false);
        onSessionRefused();
        return;
      }
      setError(result.error);
      return;
    }

    // Back must not return to an editor that no longer accepts work.
    router.replace(result.href);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        <Send data-icon="inline-end" />
        Submit
      </Button>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (pending) return;
          setConfirming(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your contest?</AlertDialogTitle>
            <AlertDialogDescription>
              {submitConfirmationText()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep working</AlertDialogCancel>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              {pending ? "Submitting" : "Submit and lock"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
