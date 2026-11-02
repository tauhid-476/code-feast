"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { submitContestAction } from "@/app/e/[code]/actions";
import { submitConfirmationText } from "@/lib/contest/copy";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
        variant="solid"
        iconRight={null}
        size="sm"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className="text-xs"
      >
        <Send />
        Submit
      </Button>

      <ConfirmDialog
        open={confirming}
        title="Submit your contest?"
        confirmLabel="Submit and lock"
        busyLabel="Submitting"
        cancelLabel="Keep working"
        tone="neutral"
        busy={pending}
        error={error}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      >
        {submitConfirmationText()}

        {/* Solved vs Remaining Reminder Card */}
        {summary ? (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Questions Overview</span>
              <span className="text-muted-foreground">{summary.total} total</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-emerald-600/30 p-2 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400">
                <div className="text-lg font-bold">{summary.solved}</div>
                <div className="text-[11px] font-medium">Solved</div>
              </div>
              <div className="rounded-md border border-amber-600/30 p-2 text-amber-700 dark:border-amber-400/30 dark:text-amber-300">
                <div className="text-lg font-bold">{summary.attempted}</div>
                <div className="text-[11px] font-medium">Attempted</div>
              </div>
              <div className="rounded-md border border-border p-2 text-muted-foreground">
                <div className="text-lg font-bold">{summary.unattempted}</div>
                <div className="text-[11px] font-medium">Remaining</div>
              </div>
            </div>

            {summary.unattempted > 0 ? (
              <Alert tone="warning">
                You still have{" "}
                <span className="font-bold underline">{summary.unattempted} remaining</span>{" "}
                unattempted question{summary.unattempted === 1 ? "" : "s"}.
              </Alert>
            ) : summary.attempted > 0 ? (
              <Alert tone="info">
                You have {summary.attempted} question
                {summary.attempted === 1 ? "" : "s"} attempted without passing all
                sample cases.
              </Alert>
            ) : (
              <Alert tone="success">
                All {summary.total} questions solved.
              </Alert>
            )}
          </div>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
