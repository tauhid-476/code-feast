"use client";

import { RunResultView } from "@/components/run-result";
import { Alert } from "@/components/ui/alert";
import type { RunResult } from "@/lib/runner/run";

/**
 * Where a Participant's Run answer lands. A refusal — the runner is busy, the
 * interval has not passed, the contest is locked — is shown as the server's own
 * message, because the clock has not stopped and the next Run may work.
 */
export function ContestRunOutcome({
  error,
  result,
}: {
  error: string | null;
  result: RunResult | null;
}) {
  if (error) {
    return (
      <Alert tone="danger" title="Run did not start">
        {error}
      </Alert>
    );
  }
  if (!result) return null;
  return <RunResultView result={result} />;
}
