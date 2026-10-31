"use client";

import { ChevronLeft, ChevronRight, Check, CircleDot } from "lucide-react";
import type { ContestProblemView } from "@/components/contest-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "cn";

export type ProblemStatus = "solved" | "attempted" | "unattempted";

export function ContestProblemNav({
  problems,
  selectedProblemId,
  onSelectProblem,
  statuses,
}: {
  problems: ContestProblemView[];
  selectedProblemId: string;
  onSelectProblem: (id: string) => void;
  statuses: Record<string, ProblemStatus>;
}) {
  const currentIndex = problems.findIndex((p) => p.id === selectedProblemId);
  const currentProblem = problems[currentIndex] ?? problems[0];

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < problems.length - 1;

  function goToPrevious() {
    if (hasPrevious) {
      onSelectProblem(problems[currentIndex - 1].id);
    }
  }

  function goToNext() {
    if (hasNext) {
      onSelectProblem(problems[currentIndex + 1].id);
    }
  }

  const solvedCount = problems.filter((p) => statuses[p.id] === "solved").length;

  return (
    <div className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-sm">
      {/* Navigation Chevrons and Quick Switcher */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          disabled={!hasPrevious}
          onClick={goToPrevious}
          aria-label="Previous question"
          title="Previous question"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        {/* Dropdown list of all questions */}
        <Select
          value={currentProblem.id}
          onValueChange={(val) => {
            if (val) onSelectProblem(val);
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-7 max-w-[200px] gap-2 px-2 text-xs font-medium sm:max-w-[260px]"
            aria-label="Select question"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="mono text-muted-foreground font-semibold">
                {String(currentProblem.position).padStart(2, "0")}
              </span>
              <span className="truncate">{currentProblem.title}</span>
            </div>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-[300px]">
            {problems.map((item) => {
              const status = statuses[item.id] ?? "unattempted";
              return (
                <SelectItem key={item.id} value={item.id} className="text-xs">
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="mono text-muted-foreground font-semibold">
                        {String(item.position).padStart(2, "0")}
                      </span>
                      <span className="truncate font-medium">{item.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.difficulty ? (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {item.difficulty}
                        </Badge>
                      ) : null}
                      {status === "solved" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                          <Check className="size-3" /> Solved
                        </span>
                      ) : status === "attempted" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                          <CircleDot className="size-3" /> Attempted
                        </span>
                      ) : null}
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          disabled={!hasNext}
          onClick={goToNext}
          aria-label="Next question"
          title="Next question"
        >
          <ChevronRight className="size-3.5" />
        </Button>

        {/* Quick pill tabs for small problem sets */}
        <div className="hidden items-center gap-1 sm:flex ml-1">
          {problems.map((item) => {
            const isSelected = item.id === currentProblem.id;
            const status = statuses[item.id] ?? "unattempted";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectProblem(item.id)}
                title={`${item.title} (${status})`}
                className={cn(
                  "relative flex size-6 items-center justify-center rounded-md text-xs font-medium transition-all",
                  isSelected
                    ? "bg-accent text-accent-foreground ring-1 ring-ring font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  status === "solved" && "text-emerald-400 font-semibold",
                  status === "attempted" && "text-amber-400",
                )}
              >
                {item.position}
                {status === "solved" ? (
                  <span className="absolute -top-0.5 -right-0.5 flex size-2 items-center justify-center rounded-full bg-emerald-500 ring-1 ring-background" />
                ) : status === "attempted" ? (
                  <span className="absolute -top-0.5 -right-0.5 flex size-2 items-center justify-center rounded-full bg-amber-500 ring-1 ring-background" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Solved / Remaining counter */}
      <div className="flex shrink-0 items-center gap-1.5">
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            solvedCount === problems.length
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-muted text-muted-foreground",
          )}
        >
          {solvedCount === problems.length ? (
            <Check className="size-3" />
          ) : (
            <CircleDot className="size-3" />
          )}
          <span>
            {solvedCount}/{problems.length} Solved
          </span>
        </div>
      </div>
    </div>
  );
}
