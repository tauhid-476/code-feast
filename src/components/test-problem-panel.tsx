"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import type { TestProblemActionState } from "@/app/admin/events/[id]/actions";
import { RunResultView } from "@/components/run-result";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  LANGUAGE_LABELS,
  LANGUAGES,
  isLanguage,
  type Language,
} from "@/lib/languages";
import type { RunResult } from "@/lib/runner/run";

type Codes = Record<Language, string>;
type Results = Partial<Record<Language, RunResult>>;

const EMPTY_CODES: Codes = { python: "", java: "", cpp: "" };

/** Runs one reference solution. The dialog supplies the Server Action. */
export type TestProblemRun = (
  language: Language,
  code: string,
) => Promise<TestProblemActionState>;

/**
 * SPEC §4.3: the organizer pastes a reference solution for one Problem and one
 * language, and it runs against that Problem's two Sample Test Cases through the
 * real runner and the real Harness. The organizer's code is all they supply;
 * the Harness is appended server-side by the Run pipeline.
 */
export function TestProblemPanel({ run: runSolution }: { run: TestProblemRun }) {
  const [active, setActive] = useState<Language>("python");
  const [codes, setCodes] = useState<Codes>(EMPTY_CODES);
  const [results, setResults] = useState<Results>({});
  const [error, setError] = useState<{
    language: Language;
    message: string;
  } | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const [running, startRunning] = useTransition();

  function edit(language: Language, code: string) {
    setCodes((current) => ({ ...current, [language]: code }));
    // The old result described the old code; showing it beside the new code
    // would be a lie, so it goes away as soon as the code changes.
    setResults((current) => {
      const next = { ...current };
      delete next[language];
      return next;
    });
  }

  function run(language: Language) {
    setError(null);
    setPendingLanguage(language);

    startRunning(async () => {
      const response = await runSolution(language, codes[language]);
      setPendingLanguage(null);

      if ("error" in response) {
        setError({ language, message: response.error });
        return;
      }

      setResults((current) => ({ ...current, [language]: response.result }));
    });
  }

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        if (isLanguage(value)) setActive(value);
      }}
    >
      <TabsList aria-label="Language">
        {LANGUAGES.map((language) => (
          <TabsTrigger key={language} value={language}>
            {LANGUAGE_LABELS[language]}
          </TabsTrigger>
        ))}
      </TabsList>

      {LANGUAGES.map((language) => {
        const code = codes[language];
        const result = results[language];
        const isRunningThis = running && pendingLanguage === language;

        return (
          <TabsContent key={language} value={language} className="mt-3">
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel htmlFor={`test-solution-${language}`}>
                  Reference solution
                </FieldLabel>
                <FieldDescription>
                  The {LANGUAGE_LABELS[language]} file you would solve this
                  problem in, exactly as a participant would write it. The
                  hidden Harness is appended on the server, so do not paste it.
                </FieldDescription>
                <Textarea
                  id={`test-solution-${language}`}
                  value={code}
                  onChange={(event) => edit(language, event.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  className="mono min-h-48 resize-y text-[0.8rem] leading-relaxed"
                  placeholder="Paste your solution, not the Harness."
                />
              </Field>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Both sample test cases always run, in order.
                </p>
                <Button
                  onClick={() => run(language)}
                  disabled={!code.trim() || running}
                >
                  {isRunningThis ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Play data-icon="inline-start" />
                  )}
                  {isRunningThis ? "Running…" : "Run samples"}
                </Button>
              </div>

              {error?.language === language ? (
                <Alert variant="destructive">
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              ) : null}

              {result ? <RunResultView result={result} /> : null}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
