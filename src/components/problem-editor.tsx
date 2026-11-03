"use client";

import {
  useRef,
  useState,
  useTransition,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createProblemAction,
  updateProblemAction,
} from "@/app/admin/events/[id]/actions";
import { uploadFigure, type UploadedFigure } from "@/components/figure-upload";
import { ProblemLanguages } from "@/components/problem-languages";
import { Statement } from "@/components/statement";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardText, CardTitle } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  figureDimensionsMap,
  type FigureView,
} from "@/lib/figures/types";
import type { ProblemSummary } from "@/lib/problems/queries";

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

  const [parameters, setParameters] = useState<string[]>(() => {
    const existing = problem?.sampleCases ?? [];
    if (existing[0]?.variables && existing[0].variables.length > 0) {
      return existing[0].variables.map((v) => v.name);
    }
    if (existing[0]?.input) {
      const lines = existing[0].input.split("\n");
      if (lines.length > 1) {
        return lines.map((_, i) => (i === 0 ? "nums" : i === 1 ? "target" : `param${i + 1}`));
      }
      return ["input"];
    }
    return ["nums", "target"];
  });

  const [caseValues, setCaseValues] = useState<string[][]>(() => {
    const existing = problem?.sampleCases ?? [];
    return [0, 1].map((caseIdx) => {
      const sc = existing[caseIdx];
      if (sc?.variables && sc.variables.length > 0) {
        return sc.variables.map((v) => v.value);
      }
      if (sc?.input) {
        const lines = sc.input.split("\n");
        return lines;
      }
      return ["", ""];
    });
  });

  const [expectedOutputs, setExpectedOutputs] = useState<string[]>(() => {
    const existing = problem?.sampleCases ?? [];
    return [existing[0]?.expectedOutput ?? "", existing[1]?.expectedOutput ?? ""];
  });

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statementRef = useRef<HTMLTextAreaElement>(null);
  const statementValueRef = useRef(statementMd);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addParameter() {
    setParameters((prev) => [...prev, `param${prev.length + 1}`]);
    setCaseValues((prev) => [
      [...(prev[0] ?? []), ""],
      [...(prev[1] ?? []), ""],
    ]);
  }

  function removeParameter(pIdx: number) {
    if (parameters.length <= 1) return;
    setParameters((prev) => prev.filter((_, i) => i !== pIdx));
    setCaseValues((prev) => [
      (prev[0] ?? []).filter((_, i) => i !== pIdx),
      (prev[1] ?? []).filter((_, i) => i !== pIdx),
    ]);
  }

  function updateParameterName(pIdx: number, name: string) {
    setParameters((prev) => prev.map((curr, i) => (i === pIdx ? name : curr)));
  }

  function updateCaseValue(sampleIndex: number, pIdx: number, value: string) {
    setCaseValues((prev) => {
      const next = [[...(prev[0] ?? [])], [...(prev[1] ?? [])]];
      while (next[sampleIndex].length <= pIdx) {
        next[sampleIndex].push("");
      }
      next[sampleIndex][pIdx] = value;
      return next;
    });
  }

  function updateExpectedOutput(sampleIndex: number, value: string) {
    setExpectedOutputs((prev) => {
      const next = [...prev];
      next[sampleIndex] = value;
      return next;
    });
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

    const sampleCasesPayload = [0, 1].map((sampleIndex) => {
      const vars = parameters.map((param, pIdx) => ({
        name: param.trim() || `param${pIdx + 1}`,
        value: caseValues[sampleIndex]?.[pIdx] ?? "",
      }));
      const rawInput = vars.map((v) => v.value).join("\n");
      return {
        input: rawInput,
        expectedOutput: expectedOutputs[sampleIndex] ?? "",
        variables: vars,
      };
    });

    const input = {
      title,
      difficulty,
      statementMd,
      sampleCases: sampleCasesPayload,
    };

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
    <Card className="backdrop-blur-none sm:opacity-100">
      <CardBody className="gap-3">
        <CardTitle>{problem ? "Edit problem" : "New problem"}</CardTitle>
        <CardText className="line-clamp-none">
          The statement is Markdown. Samples are shown to participants with it.
        </CardText>
        <form onSubmit={submit}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
              <Field label="Title">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Two Sum"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>

              <Field label="Difficulty" aside="optional">
                <Input
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                  placeholder="Easy"
                  autoComplete="off"
                  maxLength={24}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="problem-statement">Statement</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void addFigures(files);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!problem || !figuresEnabled || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  title={
                    !figuresEnabled
                      ? "Figure storage is not configured"
                      : !problem
                        ? "Save the problem before adding figures"
                        : undefined
                  }
                  className="gap-1.5"
                >
                  <ImagePlus className="size-3.5" />
                  <span>{uploading ? "Uploading…" : "Add figure"}</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                GitHub Flavored Markdown. Paste images directly or use Add
                figure to upload PNG, JPEG, or WebP up to 2MB each. They insert as
                a Figure at the cursor.
              </p>
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
            </div>

            {/* Input Parameters Definition */}
            <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="label">Input Parameters</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Define parameter names for problem inputs (e.g. <code className="mono text-[11px]">nums</code>, <code className="mono text-[11px]">target</code> or <code className="mono text-[11px]">n</code>, <code className="mono text-[11px]">edges</code>).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addParameter}
                  className="gap-1 text-xs"
                >
                  <Plus className="size-3" />
                  <span>Add parameter</span>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {parameters.map((param, pIdx) => (
                  <div
                    key={pIdx}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1"
                  >
                    <span className="mono text-xs text-muted-foreground select-none">
                      param {pIdx + 1}:
                    </span>
                    <input
                      type="text"
                      value={param}
                      onChange={(e) => updateParameterName(pIdx, e.target.value)}
                      placeholder={`param${pIdx + 1}`}
                      className="mono h-6 w-24 bg-transparent text-xs text-foreground focus:outline-hidden"
                    />
                    {parameters.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeParameter(pIdx)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded cursor-pointer"
                        title="Remove parameter"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            {/* Sample test cases */}
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="label">Sample test cases</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Exactly two. Both run on every participant Run, in this order.
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {[0, 1].map((sampleIndex) => (
                  <div
                    key={sampleIndex}
                    className="rounded-lg border border-border bg-background/40 p-4"
                  >
                    <p className="label">Sample {sampleIndex + 1}</p>
                    <div className="mt-3 flex flex-col gap-3">
                      {parameters.map((param, pIdx) => {
                        const paramName = param.trim() || `param${pIdx + 1}`;
                        return (
                          <Field key={pIdx} label={`${paramName} =`}>
                            <Textarea
                              value={caseValues[sampleIndex]?.[pIdx] ?? ""}
                              onChange={(event) =>
                                updateCaseValue(sampleIndex, pIdx, event.target.value)
                              }
                              placeholder={pIdx === 0 ? "2 7 11 15" : "9"}
                              className="mono min-h-16 text-[0.8rem]"
                            />
                          </Field>
                        );
                      })}

                      <Field label="Expected output">
                        <Textarea
                          value={expectedOutputs[sampleIndex] ?? ""}
                          onChange={(event) =>
                            updateExpectedOutput(sampleIndex, event.target.value)
                          }
                          placeholder="0 1"
                          className="mono min-h-16 text-[0.8rem]"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {error ? <Alert tone="danger">{error}</Alert> : null}

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
      </CardBody>
    </Card>
  );
}
