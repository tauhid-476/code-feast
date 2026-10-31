"use client";

import {
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  createProblemAction,
  updateProblemAction,
} from "@/app/admin/events/[id]/actions";
import { uploadFigure, type UploadedFigure } from "@/components/figure-upload";
import { ProblemLanguages } from "@/components/problem-languages";
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
import {
  figureDimensionsMap,
  type FigureView,
} from "@/lib/figures/types";
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
  figuresEnabled,
  onDone,
}: {
  eventId: string;
  problem: ProblemSummary | null;
  /** False when the deployment has no figures bucket. */
  figuresEnabled: boolean;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(problem?.title ?? "");
  const [difficulty, setDifficulty] = useState(problem?.difficulty ?? "");
  const [statementMd, setStatementMd] = useState(problem?.statementMd ?? "");
  const [figures, setFigures] = useState<FigureView[]>(
    problem?.figures ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [sampleCases, setSampleCases] = useState<SampleCaseDraft[]>(() => {
    const existing = problem?.sampleCases ?? [];
    return EMPTY_SAMPLE_CASES.map((empty, index) => ({
      input: existing[index]?.input ?? empty.input,
      expectedOutput: existing[index]?.expectedOutput ?? empty.expectedOutput,
    }));
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statementRef = useRef<HTMLTextAreaElement>(null);
  const statementValueRef = useRef(statementMd);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateSampleCase(index: number, patch: Partial<SampleCaseDraft>) {
    setSampleCases((current) =>
      current.map((sampleCase, position) =>
        position === index ? { ...sampleCase, ...patch } : sampleCase,
      ),
    );
  }

  const figureMap = figureDimensionsMap(figures);

  function insertFigure(figure: UploadedFigure) {
    const textarea = statementRef.current;
    // Several figures can be pasted at once; the textarea's value and state lag
    // one render behind, so read the latest text from the ref.
    const current = statementValueRef.current;
    const from = textarea?.selectionStart ?? current.length;
    const to = textarea?.selectionEnd ?? from;
    const before = current.slice(0, from);
    const after = current.slice(to);
    const number = (current.match(/\/api\/figures\//g) ?? []).length + 1;
    const insertion = `\n\n![Figure ${number}](/api/figures/${figure.id})\n\n`;
    const next = `${before}${insertion}${after}`;
    const cursor = before.length + insertion.length;

    statementValueRef.current = next;
    setStatementMd(next);
    requestAnimationFrame(() => {
      const node = statementRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(cursor, cursor);
    });
  }

  async function addFigures(files: File[]) {
    if (files.length === 0) return;
    if (!problem) {
      toast.error("Save the problem before adding a figure.");
      return;
    }
    if (!figuresEnabled) {
      toast.error("Figure storage is not configured on this deployment.");
      return;
    }

    setUploading(true);
    let added = 0;
    try {
      for (const file of files) {
        const uploaded = await uploadFigure(file, problem.id);
        setFigures((current) => [...current, uploaded]);
        insertFigure(uploaded);
        added += 1;
      }
      if (added > 0) {
        toast.success(added === 1 ? "Figure added" : "Figures added");
      }
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error
          ? uploadError.message
          : "The figure could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    event.preventDefault();
    void addFigures(files);
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel htmlFor="problem-statement">Statement</FieldLabel>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void addFigures(files);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={!problem || !figuresEnabled || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus data-icon="inline-start" />
                  {uploading ? "Adding…" : "Add figure"}
                </Button>
              </div>
              <FieldDescription>
                Markdown. Raw HTML is not rendered, so anything that looks like
                a tag stays literal text. Paste a PNG, JPEG or WebP image to add
                a Figure at the cursor.
              </FieldDescription>
              {!figuresEnabled ? (
                <p className="text-xs text-muted-foreground">
                  Figure storage is not configured on this deployment, so
                  figures cannot be added.
                </p>
              ) : !problem ? (
                <p className="text-xs text-muted-foreground">
                  Save this problem first, then add figures.
                </p>
              ) : null}
              <div className="grid gap-3 lg:grid-cols-2">
                <Textarea
                  ref={statementRef}
                  id="problem-statement"
                  value={statementMd}
                  onChange={(event) => {
                    statementValueRef.current = event.target.value;
                    setStatementMd(event.target.value);
                  }}
                  onPaste={handlePaste}
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
                    <Statement markdown={statementMd} figures={figureMap} />
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

        {problem ? (
          <ProblemLanguages eventId={eventId} problem={problem} />
        ) : (
          <section className="mt-6 rounded-lg border border-dashed border-border p-4">
            <h3 className="text-sm font-medium">Starter code and harness</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Save this problem first, then attach Starter Code and Harness for
              Python 3, Java, and C++.
            </p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
