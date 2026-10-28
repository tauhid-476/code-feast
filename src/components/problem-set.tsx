"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { moveProblemAction } from "@/app/admin/events/[id]/actions";
import { ProblemCompleteness } from "@/components/problem-completeness";
import { ProblemEditor } from "@/components/problem-editor";
import { TestProblemDialog } from "@/components/test-problem-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { MoveDirection } from "@/lib/problems/manage";
import type { ProblemSummary } from "@/lib/problems/queries";

type EditorState = { mode: "new" } | { mode: "edit"; problemId: string } | null;

export function ProblemSet({
  eventId,
  editable,
  problems,
}: {
  eventId: string;
  editable: boolean;
  problems: ProblemSummary[];
}) {
  const [editor, setEditor] = useState<EditorState>(null);
  const [pending, startTransition] = useTransition();

  const editingProblem =
    editor?.mode === "edit"
      ? (problems.find((problem) => problem.id === editor.problemId) ?? null)
      : null;

  function move(problemId: string, direction: MoveDirection) {
    startTransition(async () => {
      const result = await moveProblemAction(eventId, problemId, direction);
      if ("error" in result) toast.error(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Problems</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Participants see these in this order once the event goes live.
          </p>
        </div>
        {editable ? (
          <Button onClick={() => setEditor({ mode: "new" })}>
            <Plus data-icon="inline-start" />
            Add problem
          </Button>
        ) : null}
      </div>

      {problems.length === 0 ? (
        <Empty className="border border-dashed border-border py-12">
          <EmptyHeader>
            <EmptyTitle>No problems yet</EmptyTitle>
            <EmptyDescription>
              Add the first problem: a title, a Markdown statement, two sample
              test cases, then Starter Code and a Harness for each language.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-2">
          {problems.map((problem, index) => (
            <li key={problem.id}>
              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <span className="mono w-5 shrink-0 text-sm text-muted-foreground tabular">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {problem.title}
                      </span>
                      {problem.difficulty ? (
                        <Badge variant="outline">{problem.difficulty}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{problem.sampleCases.length} sample test cases</span>
                      <span aria-hidden>·</span>
                      <ProblemCompleteness starters={problem.starters} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <TestProblemDialog
                      eventId={eventId}
                      problemId={problem.id}
                      problemTitle={problem.title}
                    />
                    {editable ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${problem.title} up`}
                          onClick={() => move(problem.id, "up")}
                          disabled={index === 0 || pending}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${problem.title} down`}
                          onClick={() => move(problem.id, "down")}
                          disabled={index === problems.length - 1 || pending}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditor({ mode: "edit", problemId: problem.id })
                          }
                        >
                          <Pencil data-icon="inline-start" />
                          Edit
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {editable && editor ? (
        <ProblemEditor
          key={editingProblem?.id ?? "new"}
          eventId={eventId}
          problem={editingProblem}
          onDone={() => setEditor(null)}
        />
      ) : null}
    </section>
  );
}
