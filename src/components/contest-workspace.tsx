"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { ContestCountdown } from "@/components/contest-countdown";
import { ContestEditor } from "@/components/contest-editor";
import { ContestRunOutcome } from "@/components/contest-run-outcome";
import { Statement } from "@/components/statement";
import { SubmitContest } from "@/components/submit-contest";
import { useContestDrafts } from "@/components/use-contest-drafts";
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
import { isLanguage, LANGUAGE_LABELS, LANGUAGES, type Language } from "@/lib/languages";

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
 */
export function ContestWorkspace({
  code,
  eventTitle,
  participantId,
  participantName,
  problems,
  drafts,
  serverNow,
  deadlineAt,
}: {
  code: string;
  eventTitle: string;
  participantId: string;
  participantName: string;
  problems: ContestProblemView[];
  drafts: ContestDraftView[];
  serverNow: string;
  deadlineAt: string | null;
}) {
  const [selectedProblemId, setSelectedProblemId] = useState(
    problems[0]?.id ?? "",
  );
  const [language, setLanguage] = useState<Language>(
    problems[0] ? languagesFor(problems[0])[0] : "python",
  );

  const { hydrated, buffers, updateCode, retryAll, flushAll, dirtyCount, saving, failed, saved } =
    useContestDrafts({
      code,
      participantId,
      problems,
      drafts,
      serverNow,
    });
  const router = useRouter();
  const runState = useContestRun({
    joinCode: code,
    onLocked: () => router.refresh(),
  });

  if (problems.length === 0) {
    return (
      <main className="flex h-dvh items-center justify-center p-6">
        <Empty className="border border-border">
          <EmptyHeader>
            <EmptyTitle>No problems yet</EmptyTitle>
            <EmptyDescription>
              The organizer has not published any problems for this event.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    );
  }

  const problem =
    problems.find((candidate) => candidate.id === selectedProblemId) ??
    problems[0];
  const availableLanguages = languagesFor(problem);
  const key = draftKey(problem.id, language);
  const buffer = buffers[key];

  function selectProblem(id: string) {
    setSelectedProblemId(id);
    // What was run belongs to the Problem and language that produced it.
    runState.clear();
    const next = problems.find((candidate) => candidate.id === id);
    if (!next) return;
    const languages = languagesFor(next);
    if (!languages.includes(language)) setLanguage(languages[0]);
  }

  const saveText = failed
    ? "Not saved"
    : saving || dirtyCount > 0
      ? "Saving…"
      : saved
        ? "Saved"
        : "Autosave on";

  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="label">Contest</span>
          <h1 className="truncate text-sm font-medium">{eventTitle}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {participantName}
          </span>
          <ContestCountdown
            code={code}
            serverNow={serverNow}
            deadlineAt={deadlineAt}
          />
          {/* Ticket 11 owns Submit: confirmation, lockout, terminal screen. */}
          <SubmitContest code={code} flush={flushAll} disabled={!hydrated} />
        </div>
      </header>

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

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="flex min-h-0 flex-col overflow-y-auto border-r border-border">
          <nav aria-label="Problems" className="flex flex-col gap-1 p-3">
            {problems.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={item.id === problem.id ? "secondary" : "ghost"}
                size="sm"
                className="h-auto w-full justify-start gap-3 px-3 py-2"
                aria-current={item.id === problem.id ? "true" : undefined}
                onClick={() => selectProblem(item.id)}
              >
                <span className="mono text-xs text-muted-foreground">
                  {String(item.position).padStart(2, "0")}
                </span>
                <span className="truncate">{item.title}</span>
                {item.difficulty ? (
                  <Badge variant="outline" className="ml-auto">
                    {item.difficulty}
                  </Badge>
                ) : null}
              </Button>
            ))}
          </nav>

          <article className="flex flex-col gap-6 px-5 pt-2 pb-10">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {problem.title}
              </h2>
              {problem.difficulty ? (
                <Badge variant="outline">{problem.difficulty}</Badge>
              ) : null}
            </div>

            <Statement markdown={problem.statementMd} />

            {problem.sampleCases.length > 0 ? (
              <section className="flex flex-col gap-3">
                <h3 className="label">Sample test cases</h3>
                {problem.sampleCases.map((sample) => (
                  <div
                    key={sample.position}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <p className="label">Sample {sample.position}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <dt className="label">Input</dt>
                        <dd className="mono mt-1 max-h-32 overflow-auto text-xs whitespace-pre-wrap text-foreground">
                          {sample.input}
                        </dd>
                      </div>
                      <div>
                        <dt className="label">Expected</dt>
                        <dd className="mono mt-1 max-h-32 overflow-auto text-xs whitespace-pre-wrap text-foreground">
                          {sample.expectedOutput}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </section>
            ) : null}
          </article>
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
            <div className="flex items-center gap-3">
              <Select
                value={language}
                onValueChange={(value) => {
                  if (!isLanguage(value)) return;
                  setLanguage(value);
                  // The verdict belongs to the language that was run.
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

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={runState.running || !buffer}
              onClick={() => {
                if (!buffer) return;
                void runState.run({
                  problemId: problem.id,
                  language,
                  code: buffer.code,
                });
              }}
            >
              {runState.running ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Play data-icon="inline-start" />
              )}
              {runState.running ? "Running" : "Run"}
            </Button>
          </div>

          <div className="min-h-0 flex-1">
            {hydrated && buffer ? (
              <ContestEditor
                problemId={problem.id}
                language={language}
                defaultValue={buffer.code}
                onChange={(next) => {
                  updateCode(key, next);
                  runState.clear();
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Opening your work
              </div>
            )}
          </div>

          {runState.error || runState.result ? (
            <div className="max-h-80 shrink-0 overflow-y-auto border-t border-border p-3">
              <ContestRunOutcome
                error={runState.error}
                result={runState.result}
              />
            </div>
          ) : null}

          <div className="flex h-9 shrink-0 items-center justify-between border-t border-border px-3">
            <span className="text-xs text-muted-foreground">
              {LANGUAGE_LABELS[language]}
            </span>
            <span className="text-xs text-muted-foreground">
              One Run at a time · two seconds between Runs
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
