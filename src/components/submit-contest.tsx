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

export type ProblemSummaryItem = {
  id: string;
  position: number;
  title: string;
  status: "solved" | "attempted" | "unattempted";
};

export type ProblemSummary = {
  total: number;
  solved: number;
  attempted: number;
  unattempted: number;
  problems: ProblemSummaryItem[];
};

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
  summary,
}: {
  code: string;
  /** This tab's session: Submit is refused for a displaced tab (ticket 14). */
  sessionId: string;
  /** Saves whatever is still pending; false means the work is not on the server. */
  flush: () => Promise<boolean>;
  disabled?: boolean;
  /** The Submit was refused because another tab took over: explain it in place. */
  onSessionRefused: () => void;
  /** Optional summary of solved/attempted/unattempted questions */
  summary?: ProblemSummary;
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
        className="h-8 px-3 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black border-none shadow-xs transition-colors"
      >
        <Send className="size-3.5 mr-1" />
        Submit
      </Button>

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (pending) return;
          setConfirming(open);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your contest?</AlertDialogTitle>
            <AlertDialogDescription>
              {submitConfirmationText()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Solved vs Remaining Reminder Card */}
          {summary ?  (
            <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Questions Overview</span>
                <span className="text-muted-foreground">{summary.total} total</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
                  <div className="text-lg font-bold">{summary.solved}</div>
                  <div className="text-[11px] font-medium">Solved</div>
                </div>
                <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-2 text-amber-400">
                  <div className="text-lg font-bold">{summary.attempted}</div>
                  <div className="text-[11px] font-medium">Attempted</div>
                </div>
                <div className="rounded-md border border-border bg-muted/40 p-2 text-muted-foreground">
                  <div className="text-lg font-bold">{summary.unattempted}</div>
                  <div className="text-[11px] font-medium">Remaining</div>
                </div>
              </div>

              {summary.unattempted > 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300">
                  <p className="font-medium">
                    ⚠️ You still have <span className="font-bold underline">{summary.unattempted} remaining</span> unattempted question{summary.unattempted === 1 ? "" : "s"}.
                  </p>
                </div>
              ) : summary.attempted > 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300">
                  <p className="font-medium">
                    ℹ️ You have {summary.attempted} question{summary.attempted === 1 ? "" : "s"} attempted without passing all sample cases.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-300">
                  <p className="font-medium">
                    ✓ All {summary.total} questions solved!
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep working</AlertDialogCancel>
            <Button
              type="button"
              onClick={submit}
              disabled={pending}
              className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
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
