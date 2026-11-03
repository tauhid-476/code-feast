"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Code2, Maximize2, Play } from "lucide-react";
import { ContestCountdown } from "@/components/contest-countdown";
import { ContestEditor } from "@/components/contest-editor";
import { ContestProblemNav, type ProblemStatus } from "@/components/contest-problem-nav";
import { ContestTestPanel, type TestPanelTab } from "@/components/contest-test-panel";
import { ModeToggle } from "@/components/mode-toggle";
import { Statement } from "@/components/statement";
import { StrikeCounter } from "@/components/strike-counter";
import { SubmitContest, type ProblemSummary } from "@/components/submit-contest";
import { useContestDrafts } from "@/components/use-contest-drafts";
import { useContestSupervision } from "@/components/use-contest-supervision";
import { useContestRun } from "@/components/use-contest-run";
import type {
  ContestDraftView,
  ContestProblemView,
} from "@/components/contest-types";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { draftKey } from "@/lib/drafts/merge";
import { figureDimensionsMap } from "@/lib/figures/types";
import { isLanguage, LANGUAGE_LABELS, LANGUAGES, type Language } from "@/lib/languages";
import type { RunResult } from "@/lib/runner/run";
import { cn } from "cn";

function languagesFor(problem: ContestProblemView): Language[] {
  if (problem.starters.length === 0) return [...LANGUAGES];
  return problem.starters.map((starter) => starter.language);
}

/**
 * The contest split pane (SPEC §5.5). Left: the Problem list and the selected
 * statement. Right: language selector, editor, Run, and the global Submit in
 * the top right.
 *
 * Run executes the current buffer against the Problem's Sample Test Cases and
 * shows the answer under the editor. Submit asks for confirmation, freezes the
 * autosaved work, and sends the participant to the terminal screen.
 *
 * Supervision (SPEC §6) lives here rather than in the editor: the strike count
 * and the heartbeat must keep running while the editor is unmounted, and the
 * counter is in the header, not the pane.
 */
export function ContestWorkspace({
  code,
  eventTitle,
  participantId,
  participantName,
  problems,
  drafts,
  sessionId,
  strikes,
  serverNow,
  deadlineAt,
  onSessionRefused,
}: {
  code: string;
  eventTitle: string;
  participantId: string;
  participantName: string;
  problems: ContestProblemView[];
  drafts: ContestDraftView[];
  /** This tab's session: every contest write carries it (ticket 14). */
  sessionId: string;
  /** The permanent count, read through the loader on this page load. */
  strikes: number;
  serverNow: string;
  deadlineAt: string | null;
  /** A write refused because another tab took over: show the explanation. */
  onSessionRefused: () => void;
}) {
  const [selectedProblemId, setSelectedProblemId] = useState(
    problems[0]?.id ?? "",
  );
  const [language, setLanguage] = useState<Language>(
    problems[0] ? languagesFor(problems[0])[0] : "python",
  );

  // Cached run results per problem so switching problems preserves status & output
  const [runResults, setRunResults] = useState<Record<string, RunResult | null>>({});
  const [activeTab, setActiveTab] = useState<TestPanelTab>("testcase");
  const [isTestPanelCollapsed, setIsTestPanelCollapsed] = useState(false);

  const { hydrated, buffers, updateCode, retryAll, flushAll, dirtyCount, saving, failed, saved } =
    useContestDrafts({
      code,
      participantId,
      problems,
      drafts,
      sessionId,
      serverNow,
      onSessionRefused,
    });
  const router = useRouter();
  const runState = useContestRun({
    joinCode: code,
    sessionId,
    onLocked: () => router.refresh(),
    onSessionRefused,
    onResult: (result, problemId) => {
      setRunResults((previous) => ({
        ...previous,
        [problemId]: result,
      }));
    },
  });
  const supervision = useContestSupervision({
    code,
    sessionId,
    initialStrikes: strikes,
    onSessionRefused,
  });

  const problem =
    problems.find((candidate) => candidate.id === selectedProblemId) ??
    problems[0];

  // Derive problem statuses: solved | attempted | unattempted
  const problemStatuses = useMemo(() => {
    const statuses: Record<string, ProblemStatus> = {};

    for (const p of problems) {
      const res = runResults[p.id] ?? (p.id === selectedProblemId ? runState.result : null);

      if (res) {
        const allPassed =
          res.cases.length > 0 &&
          res.cases.every((c) => c.pass) &&
          !res.compileError &&
          !res.sandboxError &&
          !res.timedOut;

        statuses[p.id] = allPassed ? "solved" : "attempted";
        continue;
      }

      // Check if participant modified starter code or entered code in any language
      let hasEdits = false;
      for (const starter of p.starters) {
        const buf = buffers[draftKey(p.id, starter.language)];
        if (buf && buf.code.trim().length > 0 && buf.code !== starter.starterCode) {
          hasEdits = true;
          break;
        }
      }
      if (!hasEdits) {
        for (const lang of LANGUAGES) {
          const buf = buffers[draftKey(p.id, lang)];
          if (
            buf &&
            buf.code.trim().length > 0 &&
            !p.starters.some((s) => s.language === lang)
          ) {
            hasEdits = true;
            break;
          }
        }
      }

      statuses[p.id] = hasEdits ? "attempted" : "unattempted";
    }

    return statuses;
  }, [problems, runResults, selectedProblemId, runState.result, buffers]);

  const problemSummary: ProblemSummary = useMemo(() => {
    const solved = problems.filter((p) => problemStatuses[p.id] === "solved").length;
    const attempted = problems.filter((p) => problemStatuses[p.id] === "attempted").length;
    const unattempted = problems.filter((p) => problemStatuses[p.id] === "unattempted").length;

    return {
      total: problems.length,
      solved,
      attempted,
      unattempted,
      problems: problems.map((p) => ({
        id: p.id,
        position: p.position,
        title: p.title,
        status: problemStatuses[p.id] ?? "unattempted",
      })),
    };
  }, [problems, problemStatuses]);

  if (!problem) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center p-6 text-center">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No problems in this contest</EmptyTitle>
            <EmptyDescription>
              The organizer hasn&apos;t added any problems to this event yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    );
  }

  const availableLanguages = languagesFor(problem);
  const key = draftKey(problem.id, language);
  const buffer = buffers[key];

  function selectProblem(nextId: string) {
    setSelectedProblemId(nextId);
    runState.clear();

    const target = problems.find((p) => p.id === nextId);
    if (!target) return;

    const targetLangs = languagesFor(target);
    if (!targetLangs.includes(language)) {
      setLanguage(targetLangs[0] ?? "python");
    }
  }

  function handleRun() {
    if (!buffer || runState.running) return;
    runState.run({
      problemId: problem.id,
      language,
      code: buffer.code,
    });
    setActiveTab("result");
    setIsTestPanelCollapsed(false);
  }

  const currentProblemIndex = problems.findIndex((p) => p.id === problem.id);

  const saveText = failed
    ? "Not saved"
    : saving || dirtyCount > 0
      ? "Saving…"
      : saved
        ? "Saved"
        : "Autosave on";

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Contest Top Navigation Bar: 48px height, 16px horizontal padding, vertically centered */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4 bg-card/60 backdrop-blur-xs">
        <div className="flex min-w-0 items-center gap-3">
          {/* Platform Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Code Feast"
            className="h-6 w-auto max-w-[100px] object-contain rounded"
          />
          <div className="h-4 w-px bg-border hidden md:block" />
          <span className="hidden xl:inline text-xs font-medium text-muted-foreground truncate max-w-[120px]">
            {eventTitle}
          </span>

          {/* Segmented strip of numbered pills, one per problem */}
          <ContestProblemNav
            problems={problems}
            selectedProblemId={problem.id}
            onSelectProblem={selectProblem}
            statuses={problemStatuses}
          />
        </div>

        {/* Right side of header: compact progress label + thin segmented bar, timer, submit button */}
        <div className="flex shrink-0 items-center gap-3 sm:gap-3.5">
          {participantName ? (
            <span className="hidden text-xs text-muted-foreground lg:inline font-medium">
              {participantName}
            </span>
          ) : null}

          <StrikeCounter strikes={supervision.strikes} />

          {/* Compact progress label ("0/4 solved") with thin segmented bar under it */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] font-medium leading-none text-muted-foreground tabular-nums">
              {problemSummary.solved}/{problemSummary.total} solved
            </span>
            <div
              className="flex items-center gap-0.5 h-1 w-16"
              aria-hidden="true"
            >
              {problems.map((p) => {
                const st = problemStatuses[p.id];
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "h-full flex-1 rounded-full transition-colors",
                      st === "solved"
                        ? "bg-emerald-500"
                        : st === "attempted"
                          ? "bg-amber-500"
                          : "bg-muted-foreground/30",
                    )}
                  />
                );
              })}
            </div>
          </div>

          {/* Timer: mono, tabular-nums */}
          <ContestCountdown
            code={code}
            serverNow={serverNow}
            deadlineAt={deadlineAt}
          />

          <ModeToggle />

          {/* Submit button as the only amber-filled element */}
          <SubmitContest
            code={code}
            sessionId={sessionId}
            flush={flushAll}
            disabled={!hydrated}
            onSessionRefused={onSessionRefused}
            summary={problemSummary}
          />
        </div>
      </header>

      {supervision.outOfFullscreen ? (
        <Alert className="rounded-none border-x-0 border-t-0">
          <Maximize2 aria-hidden="true" />
          <AlertTitle>Fullscreen ended</AlertTitle>
          <AlertDescription>
            The contest runs in fullscreen. Leaving costs a strike, and the
            heartbeat keeps counting until you return.
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={supervision.enterFullscreen}
            >
              Return fullscreen
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {failed ? (
        <Alert
          variant="destructive"
          className="rounded-none border-x-0 border-t-0"
        >
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>
            Your code is kept on this device. It retries on the next keystroke,
            when the connection returns, or when you press Retry. Leave this tab
            open.
          </AlertDescription>
          <AlertAction>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={retryAll}
            >
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {/* Main Workspace Split View */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left Column: Problem Statement & Secondary Navigation */}
        <section className="flex min-h-0 flex-col border-r border-border bg-card/20">
          {/* Problem Statement Content */}
          <article className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="mono text-xs font-semibold text-muted-foreground">
                  {String(problem.position).padStart(2, "0")}
                </span>
                <h2 className="text-lg font-bold tracking-tight">
                  {problem.title}
                </h2>
                {problem.difficulty ? (
                  <Badge variant="outline" className="text-xs">
                    {problem.difficulty}
                  </Badge>
                ) : null}
              </div>

              {/* Status indicator */}
              {problemStatuses[problem.id] === "solved" ? (
                <Badge
                  variant="outline"
                  className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 gap-1 text-xs"
                >
                  <Check className="size-3" />
                  <span>Passed</span>
                </Badge>
              ) : problemStatuses[problem.id] === "attempted" ? (
                <Badge
                  variant="outline"
                  className="text-amber-500 border-amber-500/30 bg-amber-500/10 gap-1 text-xs"
                >
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  <span>Attempted</span>
                </Badge>
              ) : null}
            </div>

            <Statement
              markdown={problem.statementMd}
              figures={figureDimensionsMap(problem.figures)}
            />
          </article>

          {/* Secondary Navigation Footer at the bottom of the statement panel */}
          <footer className="sticky bottom-0 z-10 flex h-12 shrink-0 items-center justify-between border-t border-border bg-card/90 px-4 backdrop-blur-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={currentProblemIndex <= 0}
              onClick={() => {
                if (currentProblemIndex > 0) {
                  selectProblem(problems[currentProblemIndex - 1].id);
                }
              }}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              <span>Previous</span>
            </Button>

            <span className="text-xs text-muted-foreground tabular-nums">
              Problem {currentProblemIndex + 1} of {problems.length}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={currentProblemIndex >= problems.length - 1}
              onClick={() => {
                if (currentProblemIndex < problems.length - 1) {
                  selectProblem(problems[currentProblemIndex + 1].id);
                }
              }}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="size-4" />
            </Button>
          </footer>
        </section>

        {/* Right Column: Code Editor & LeetCode-style Test Panel */}
        <section className="flex min-h-0 flex-col bg-card/10">
          {/* Editor Top Bar */}
          <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/40 px-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                <Code2 className="size-4 text-emerald-500" />
                <span>Code</span>
              </div>
              <div className="h-3.5 w-px bg-border" />
              <Select
                value={language}
                onValueChange={(value) => {
                  if (!isLanguage(value)) return;
                  setLanguage(value);
                  runState.clear();
                }}
              >
                <SelectTrigger size="sm" aria-label="Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {availableLanguages.map((option) => (
                    <SelectItem key={option} value={option}>
                      {LANGUAGE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground">{saveText}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runState.running || !buffer}
                onClick={handleRun}
                className="gap-1.5 font-medium"
              >
                {runState.running ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Play className="size-3.5 text-emerald-500 fill-emerald-500" />
                )}
                {runState.running ? "Running" : "Run"}
              </Button>
            </div>
          </div>

          {/* Monaco Editor Canvas */}
          <div className="min-h-0 flex-1 relative">
            {hydrated && buffer ? (
              <ContestEditor
                problemId={problem.id}
                language={language}
                defaultValue={buffer.code}
                onChange={(next) => {
                  updateCode(key, next);
                }}
                onViolation={supervision.report}
              />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Opening your work
              </div>
            )}
          </div>

          {/* LeetCode Style Bottom Testcase & Test Result Panel */}
          <ContestTestPanel
            problem={problem}
            result={runResults[problem.id] ?? runState.result}
            error={runState.error}
            running={runState.running}
            onRun={handleRun}
            canRun={Boolean(buffer)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isCollapsed={isTestPanelCollapsed}
            onToggleCollapsed={() => setIsTestPanelCollapsed((prev) => !prev)}
          />

          {/* Bottom Bar Info */}
          <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/30 px-3 text-[11px] text-muted-foreground">
            <span>{LANGUAGE_LABELS[language]}</span>
            <span>One Run at a time · two seconds between Runs</span>
          </div>
        </section>
      </div>
    </main>
  );
}
