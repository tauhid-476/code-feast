"use client";

import { useState, useRef, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Play,
  SquareCheck,
  Terminal,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import type { ContestProblemView } from "@/components/contest-types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { RunResult } from "@/lib/runner/run";
import { cn } from "@/lib/utils";

export type TestPanelTab = "testcase" | "result";

export function ContestTestPanel({
  problem,
  result,
  error,
  running,
  onRun,
  canRun,
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapsed,
}: {
  problem: ContestProblemView;
  result: RunResult | null;
  error: string | null;
  running: boolean;
  onRun: () => void;
  canRun: boolean;
  activeTab: TestPanelTab;
  onTabChange: (tab: TestPanelTab) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [panelHeight, setPanelHeight] = useState(250);
  const [caseIndices, setCaseIndices] = useState<Record<string, number>>({});

  const selectedCaseIndex = caseIndices[problem.id] ?? 0;
  const setSelectedCaseIndex = (idx: number) => {
    setCaseIndices((prev) => ({ ...prev, [problem.id]: idx }));
  };

  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(250);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = panelHeight;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - moveEvent.clientY;
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.75, startHeightRef.current + delta));
      setPanelHeight(newHeight);
      if (isCollapsed) onToggleCollapsed();
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, [panelHeight, isCollapsed, onToggleCollapsed]);

  const allPassed =
    Boolean(result) &&
    result!.cases.length > 0 &&
    result!.cases.every((c) => c.pass) &&
    !result!.compileError &&
    !result!.sandboxError &&
    !result!.timedOut;

  return (
    <div
      className={cn(
        "flex flex-col border-t border-border bg-card/95 transition-[height] duration-150 ease-out select-none",
        isCollapsed ? "h-10 shrink-0" : "shrink-0",
      )}
      style={!isCollapsed ? { height: `${panelHeight}px` } : undefined}
    >
      {/* Resizer Handle (only when expanded) */}
      {!isCollapsed ? (
        <div
          onPointerDown={onPointerDown}
          className="group relative flex h-2 w-full cursor-row-resize items-center justify-center bg-transparent transition-colors hover:bg-primary/20 active:bg-primary/40 -mt-1 z-10"
          title="Drag to resize panel"
        >
          <div className="h-1 w-10 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
        </div>
      ) : null}

      {/* Panel Header & Tabs */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3 bg-muted/20">
        <div className="flex items-center gap-1">
          {/* Testcase Tab */}
          <button
            type="button"
            onClick={() => {
              onTabChange("testcase");
              if (isCollapsed) onToggleCollapsed();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === "testcase" && !isCollapsed
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <SquareCheck className="size-3.5 text-muted-foreground" />
            <span>Testcase</span>
          </button>

          {/* Test Result Tab */}
          <button
            type="button"
            onClick={() => {
              onTabChange("result");
              if (isCollapsed) onToggleCollapsed();
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === "result" && !isCollapsed
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Terminal className="size-3.5 text-muted-foreground" />
            <span>Test Result</span>
            {result ? (
              allPassed ? (
                <span className="flex size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              ) : (
                <span className="flex size-2 rounded-full bg-red-600 dark:bg-red-400" />
              )
            ) : null}
{running ? <Spinner className="[&_svg]:size-3" /> : null}
          </button>
        </div>

        {/* Panel collapse toggle button */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
size="sm"
            variant="outline"
            disabled={running || !canRun}
            onClick={() => {
              onTabChange("result");
              if (isCollapsed) onToggleCollapsed();
              onRun();
            }}
            className="gap-1.5 font-medium"
          >
            {running ? (
              <Spinner className="[&_svg]:size-3" />
            ) : (
              <Play className="size-3 text-emerald-700 fill-emerald-700 dark:text-emerald-400 dark:fill-emerald-400" />
            )}
            {running ? "Running" : "Run"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            className="size-6 text-muted-foreground hover:text-foreground"
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {isCollapsed ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>

      {/* Panel Body Content (hidden when collapsed) */}
      {!isCollapsed ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {activeTab === "testcase" ? (
            <TestcaseTabContent
              problem={problem}
              selectedCaseIndex={selectedCaseIndex}
              onSelectCase={setSelectedCaseIndex}
            />
          ) : (
            <TestResultTabContent
              result={result}
              error={error}
              running={running}
              onRun={() => {
                onTabChange("result");
                onRun();
              }}
              canRun={canRun}
              selectedCaseIndex={selectedCaseIndex}
              onSelectCase={setSelectedCaseIndex}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

function TestcaseTabContent({
  problem,
  selectedCaseIndex,
  onSelectCase,
}: {
  problem: ContestProblemView;
  selectedCaseIndex: number;
  onSelectCase: (index: number) => void;
}) {
  const cases = problem.sampleCases;
  if (cases.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No sample test cases authored for this problem.
      </div>
    );
  }

  const activeCase = cases[selectedCaseIndex] ?? cases[0];
  const hasVariables =
    Array.isArray(activeCase.variables) && activeCase.variables.length > 0;

  return (
    <div className="flex flex-col gap-3 select-text">
      {/* Case Pills */}
      <div className="flex flex-wrap items-center gap-1.5 select-none">
        {cases.map((sample, idx) => (
          <button
            key={sample.position}
            type="button"
            onClick={() => onSelectCase(idx)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              idx === selectedCaseIndex
                ? "bg-secondary text-secondary-foreground font-semibold ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Case {idx + 1}
          </button>
        ))}
      </div>

      {/* Case Variables / Input & Expected */}
      <div className="space-y-3 pt-1">
        {hasVariables ? (
          activeCase.variables!.map((v, i) => (
            <div key={i} className="space-y-1">
              <span className="mono text-xs font-medium text-muted-foreground">
                {v.name} =
              </span>
              <pre className="mono overflow-x-auto rounded-md border border-border bg-background/60 p-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {v.value || "(empty)"}
              </pre>
            </div>
          ))
        ) : (
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Input
            </span>
            <pre className="mono mt-1 overflow-x-auto rounded-md border border-border bg-background/60 p-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {activeCase.input || "(empty)"}
            </pre>
          </div>
        )}

        <div className="space-y-1">
          <span className="mono text-xs font-medium text-muted-foreground">
            Expected =
          </span>
          <pre className="mono overflow-x-auto rounded-md border border-border bg-background/60 p-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {activeCase.expectedOutput || "(empty)"}
          </pre>
        </div>
      </div>
    </div>
  );
}

function TestResultTabContent({
  result,
  error,
  running,
  onRun,
  canRun,
  selectedCaseIndex,
  onSelectCase,
}: {
  result: RunResult | null;
  error: string | null;
  running: boolean;
  onRun: () => void;
  canRun: boolean;
  selectedCaseIndex: number;
  onSelectCase: (index: number) => void;
}) {
  if (running) {
    return (
      <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
        <Spinner className="[&_svg]:size-5" />
        <span>Running code in sandbox against sample test cases...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert tone="danger" title="Run failed">
        <span className="text-xs">{error}</span>
      </Alert>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Terminal className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">You must run your code first</p>
          <p className="text-[11px] text-muted-foreground">
            Click Run to execute your solution against the sample test cases.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canRun}
          onClick={onRun}
          className="gap-1.5"
        >
          <Play className="size-3 text-emerald-700 fill-emerald-700 dark:text-emerald-400 dark:fill-emerald-400" />
          Run Code
        </Button>
      </div>
    );
  }

  if (result.compileError) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-red-600 font-semibold text-sm dark:text-red-400">
          <AlertTriangle className="size-4" />
          <span>Compile Error</span>
        </div>
        <pre className="mono max-h-48 overflow-auto rounded-md border border-red-600/30 bg-background p-2.5 text-xs text-red-700 whitespace-pre-wrap break-words leading-relaxed dark:border-red-400/30 dark:text-red-300">
          {result.compileError}
        </pre>
      </div>
    );
  }

  if (result.sandboxError) {
    return (
      <Alert tone="danger" title="Runner Error">
        <span className="text-xs">{result.sandboxError}</span>
      </Alert>
    );
  }

  if (result.timedOut) {
    return (
      <Alert tone="info" title="Time limit exceeded">
        A sample that runs past its limit is stopped and counted as a failure.
      </Alert>
    );
  }

  const cases = result.cases;
  if (cases.length === 0) {
    return <div className="text-xs text-muted-foreground">No sample test cases ran.</div>;
  }

  const passedCount = cases.filter((c) => c.pass).length;
  const isAccepted = passedCount === cases.length;
  const activeCase = cases[selectedCaseIndex] ?? cases[0];
  const totalRuntimeMs = cases.reduce((acc, c) => acc + c.ms, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* LeetCode Style Verdict Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 select-none">
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              "text-base font-bold tracking-tight",
              isAccepted
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {isAccepted ? "Accepted" : "Wrong Answer"}
          </span>
          <span className="mono text-xs text-muted-foreground tabular">
            Runtime: {totalRuntimeMs} ms
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular">
          Passed test cases: {passedCount} / {cases.length}
        </span>
      </div>

      {/* Case Pills */}
      <div className="flex flex-wrap items-center gap-1.5 select-none">
        {cases.map((c, idx) => {
          const isSelected = idx === selectedCaseIndex;
          return (
            <button
              key={c.index}
              type="button"
              onClick={() => onSelectCase(idx)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-secondary text-secondary-foreground font-semibold ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c.pass ? (
                <Check className="size-3 text-emerald-700 font-bold dark:text-emerald-400" />
              ) : (
                <X className="size-3 text-red-600 font-bold dark:text-red-400" />
              )}
              Case {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Active Case Details: Input, Your Output, Expected output, Stderr */}
      <div className="space-y-3 pt-1 select-text">
        <div>
          <span className="text-xs font-semibold text-muted-foreground">
            Input:
          </span>
          <pre className="mono mt-1 max-h-36 overflow-auto rounded-md border border-border bg-background/60 p-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {activeCase.variables && activeCase.variables.length > 0
              ? activeCase.variables.map((v) => `${v.name}=${v.value}`).join("\n")
              : activeCase.input || "(empty)"}
          </pre>
        </div>

        <div>
          <span className="text-xs font-semibold text-muted-foreground">
            Your Output:
          </span>
          <pre
            className={cn(
              "mono mt-1 max-h-36 overflow-auto rounded-md border bg-background/60 p-2.5 text-xs leading-relaxed whitespace-pre-wrap",
              activeCase.pass
                ? "border-border text-foreground"
                : "border-red-600/40 text-red-700 dark:border-red-400/40 dark:text-red-300",
            )}
          >
            {activeCase.actual.trim() ? (
              activeCase.actual
            ) : (
              <span className="text-muted-foreground">(empty)</span>
            )}
          </pre>
        </div>

        <div>
          <span className="text-xs font-semibold text-muted-foreground">
            Expected output:
          </span>
          <pre className="mono mt-1 max-h-36 overflow-auto rounded-md border border-border bg-background/60 p-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {activeCase.expected || "(empty)"}
          </pre>
        </div>

        {activeCase.stderr ? (
          <div>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Stderr / Traceback:
            </span>
            <pre className="mono mt-1 max-h-40 overflow-auto rounded-md border border-red-600/30 bg-background/60 p-2.5 text-xs leading-relaxed text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
              {activeCase.stderr}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
