"use client";

import { Badge } from "@/components/legacy-ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/legacy-ui/alert";
import { cn } from "@/lib/utils";
import type { RunCaseResult, RunResult } from "@/lib/runner/run";

/**
 * The one renderer for a Run result, in the organizer's panel now and in a
 * participant's Run later. It shows exactly what the response carries: the
 * compile error, timeouts, sandbox failures, and every sample's input,
 * expected output, actual output, stderr, exit code, duration, and verdict.
 *
 * A broken Harness is not a special case here: it produces a failing case whose
 * stderr explains it, and that is what this renders.
 */
export function RunResultView({ result }: { result: RunResult }) {
  const passed = result.cases.filter((caseResult) => caseResult.pass).length;
  const allPassed = result.cases.length > 0 && passed === result.cases.length;

  return (
    <div className="flex flex-col gap-3">
      {result.compileError ? (
        <Alert variant="destructive">
          <AlertTitle>Compile error</AlertTitle>
          <pre className="mono mt-1 max-h-64 overflow-auto rounded-md border border-destructive/30 bg-background p-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
            {result.compileError}
          </pre>
        </Alert>
      ) : null}

      {result.sandboxError ? (
        <Alert variant="destructive">
          <AlertTitle>The runner failed</AlertTitle>
          <AlertDescription>
            <p className="mono text-xs break-words">{result.sandboxError}</p>
            <p>Try the run again in a moment.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {result.timedOut ? (
        <Alert>
          <AlertTitle>Time limit exceeded</AlertTitle>
          <AlertDescription>
            A sample that runs past its limit is stopped and counted as a
            failure. Python and C++ get 3s per sample, Java 6s.
          </AlertDescription>
        </Alert>
      ) : null}

      {result.cases.length > 0 ? (
        <>
          <p className="text-sm">
            <span
              className={cn(
                "font-medium tabular",
                allPassed ? "text-success" : "text-destructive",
              )}
            >
              {passed} of {result.cases.length}
            </span>{" "}
            <span className="text-muted-foreground">
              sample test cases pass.
            </span>
          </p>

          <ul className="flex flex-col gap-2">
            {result.cases.map((caseResult) => (
              <li key={caseResult.index}>
                <RunCaseBlock caseResult={caseResult} />
              </li>
            ))}
          </ul>
        </>
      ) : result.compileError || result.sandboxError ? null : (
        <p className="text-sm text-muted-foreground">
          No sample test cases ran.
        </p>
      )}
    </div>
  );
}

function RunCaseBlock({ caseResult }: { caseResult: RunCaseResult }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="label">Sample {caseResult.index + 1}</span>
        <Badge
          variant={caseResult.pass ? "outline" : "destructive"}
          className={
            caseResult.pass ? "border-success/40 text-success" : undefined
          }
        >
          {caseResult.pass ? "Pass" : "Fail"}
        </Badge>
        <span className="mono ml-auto text-xs text-muted-foreground tabular">
          {caseResult.exitCode === null
            ? "timed out"
            : `exit ${caseResult.exitCode}`}{" "}
          · {caseResult.ms} ms
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <OutputBlock label="Input" text={caseResult.input} />
        <OutputBlock label="Expected" text={caseResult.expected} />
        <OutputBlock
          label="Actual"
          text={caseResult.actual}
          failed={!caseResult.pass}
        />
      </div>

      {caseResult.stderr ? (
        <div className="mt-2">
          <span className="label text-destructive">Stderr</span>
          <pre className="mono mt-1 max-h-40 overflow-auto rounded-md border border-destructive/30 bg-background p-2 text-xs leading-relaxed text-destructive whitespace-pre-wrap break-words">
            {caseResult.stderr}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function OutputBlock({
  label,
  text,
  failed = false,
}: {
  label: string;
  text: string;
  failed?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="label">{label}</span>
      <pre
        className={cn(
          "mono mt-1 max-h-40 min-h-12 overflow-auto rounded-md border bg-background p-2 text-xs leading-relaxed whitespace-pre-wrap break-words",
          failed ? "border-destructive/40" : "border-border",
        )}
      >
        {text.trim() ? (
          text
        ) : (
          <span className="text-muted-foreground">(empty)</span>
        )}
      </pre>
    </div>
  );
}
