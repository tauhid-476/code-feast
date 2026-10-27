"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createProblemAction,
  updateProblemAction,
} from "@/app/admin/events/[id]/actions";
import { Statement } from "@/components/statement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProblemSummary } from "@/lib/problems/queries";

type SampleCaseDraft = { input: string; expectedOutput: string };

const EMPTY_SAMPLE_CASES: SampleCaseDraft[] = [
  { input: "", expectedOutput: "" },
  { input: "", expectedOutput: "" },
];

/**
 * The statement preview is the only place Markdown is rendered while editing.
 * The same `Statement` component renders participant statements later, so the
 * preview cannot drift from what they will see.
 */
export function ProblemEditor({
  eventId,
  problem,
  onDone,
}: {
  eventId: string;
  problem: ProblemSummary | null;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(problem?.title ?? "");
  const [difficulty, setDifficulty] = useState(problem?.difficulty ?? "");
  const [statementMd, setStatementMd] = useState(problem?.statementMd ?? "");
  const [sampleCases, setSampleCases] = useState<SampleCaseDraft[]>(() => {
    const existing = problem?.sampleCases ?? [];
    return EMPTY_SAMPLE_CASES.map((empty, index) => ({
      input: existing[index]?.input ?? empty.input,
      expectedOutput: existing[index]?.expectedOutput ?? empty.expectedOutput,
    }));
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateSampleCase(index: number, patch: Partial<SampleCaseDraft>) {
    setSampleCases((current) =>
      current.map((sampleCase, position) =>
        position === index ? { ...sampleCase, ...patch } : sampleCase,
      ),
    );
  }

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    const input = { title, difficulty, statementMd, sampleCases };

    startTransition(async () => {
      const result = problem
        ? await updateProblemAction(eventId, problem.id, input)
        : await createProblemAction(eventId, input);

      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success(problem ? "Problem saved" : "Problem added");
      onDone();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{problem ? "Edit problem" : "New problem"}</CardTitle>
        <CardDescription>
          The statement is Markdown. Samples are shown to participants with it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
              <Field>
                <FieldLabel htmlFor="problem-title">Title</FieldLabel>
                <Input
                  id="problem-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Two Sum"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="problem-difficulty">
                  Difficulty
                  <span className="font-normal text-muted-foreground">
                    optional
                  </span>
                </FieldLabel>
                <Input
                  id="problem-difficulty"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                  placeholder="Easy"
                  autoComplete="off"
                  maxLength={24}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="problem-statement">Statement</FieldLabel>
              <FieldDescription>
                Markdown. Raw HTML is not rendered, so anything that looks like
                a tag stays literal text.
              </FieldDescription>
              <div className="grid gap-3 lg:grid-cols-2">
                <Textarea
                  id="problem-statement"
                  value={statementMd}
                  onChange={(event) => setStatementMd(event.target.value)}
                  placeholder={
                    "Given an array of integers and a target, return the indices of the two numbers that add up to it.\n\n## Input\n\nOne array and one target, each on its own line."
                  }
                  className="mono min-h-64 resize-y text-[0.8rem] leading-relaxed"
                  required
                />
                <div
                  role="region"
                  aria-label="Statement preview"
                  className="min-h-64 overflow-auto rounded-lg border border-border bg-background p-4"
                >
                  {statementMd.trim() ? (
                    <Statement markdown={statementMd} />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      The preview appears here as you type.
                    </p>
                  )}
                </div>
              </div>
            </Field>

            <section className="flex flex-col gap-3">
              <div>
                <h3 className="label">Sample test cases</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Exactly two. Both run on every participant Run, in this order.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {sampleCases.map((sampleCase, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border bg-background/40 p-3"
                  >
                    <p className="label">Sample {index + 1}</p>
                    <div className="mt-3 flex flex-col gap-3">
                      <Field>
                        <FieldLabel htmlFor={`sample-${index}-input`}>
                          Input
                        </FieldLabel>
                        <Textarea
                          id={`sample-${index}-input`}
                          value={sampleCase.input}
                          onChange={(event) =>
                            updateSampleCase(index, {
                              input: event.target.value,
                            })
                          }
                          placeholder={"2 7 11 15\n9"}
                          className="mono min-h-20 text-[0.8rem]"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`sample-${index}-output`}>
                          Expected output
                        </FieldLabel>
                        <Textarea
                          id={`sample-${index}-output`}
                          value={sampleCase.expectedOutput}
                          onChange={(event) =>
                            updateSampleCase(index, {
                              expectedOutput: event.target.value,
                            })
                          }
                          placeholder={"0 1"}
                          className="mono min-h-20 text-[0.8rem]"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/*
              Seam for ticket 04: the per-language Starter Code and Harness
              editors mount here. Nothing in this ticket reads them.
            */}
            <section className="rounded-lg border border-dashed border-border p-4">
              <h3 className="label">Starter code and harness</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {problem
                  ? "Per-language starter code and harness editors arrive in the next ticket."
                  : "Save this problem first, then attach per-language starter code and harness."}
              </p>
            </section>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onDone}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : problem
                    ? "Save problem"
                    : "Add problem"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
