"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import type { ContestProblemView } from "@/components/contest-types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/legacy-ui/tooltip";
import { cn } from "@/lib/utils";

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
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll overflows for fade masks
  function updateScrollState() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }

  useEffect(() => {
    updateScrollState();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [problems]);

  // Auto-scroll current pill into view
  useEffect(() => {
    const activeEl = pillRefs.current[selectedProblemId];
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
    updateScrollState();
  }, [selectedProblemId]);

  // Keyboard navigation: Alt+← / Alt+→ global shortcut
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = problems.findIndex(
          (p) => p.id === selectedProblemId,
        );
        if (currentIndex > 0) {
          const nextProblem = problems[currentIndex - 1];
          onSelectProblem(nextProblem.id);
          pillRefs.current[nextProblem.id]?.focus();
        }
      } else if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        const currentIndex = problems.findIndex(
          (p) => p.id === selectedProblemId,
        );
        if (currentIndex < problems.length - 1) {
          const nextProblem = problems[currentIndex + 1];
          onSelectProblem(nextProblem.id);
          pillRefs.current[nextProblem.id]?.focus();
        }
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [problems, selectedProblemId, onSelectProblem]);

  // Roving tabindex keyboard navigation inside tablist
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let nextIndex = -1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = index > 0 ? index - 1 : problems.length - 1;
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = index < problems.length - 1 ? index + 1 : 0;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = problems.length - 1;
    }

    if (nextIndex >= 0) {
      const nextProblem = problems[nextIndex];
      onSelectProblem(nextProblem.id);
      pillRefs.current[nextProblem.id]?.focus();
    }
  }

  // Mask image for overflow fade
  const maskStyle = {
    maskImage:
      canScrollLeft && canScrollRight
        ? "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)"
        : canScrollLeft
          ? "linear-gradient(to right, transparent, black 16px, black 100%)"
          : canScrollRight
            ? "linear-gradient(to right, black 0%, black calc(100% - 16px), transparent)"
            : undefined,
    WebkitMaskImage:
      canScrollLeft && canScrollRight
        ? "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)"
        : canScrollLeft
          ? "linear-gradient(to right, transparent, black 16px, black 100%)"
          : canScrollRight
            ? "linear-gradient(to right, black 0%, black calc(100% - 16px), transparent)"
            : undefined,
  };

  return (
    <TooltipProvider delay={100}>
      <div
        className="relative flex min-w-0 max-w-full items-center overflow-hidden"
        style={maskStyle}
      >
        <div
          ref={scrollContainerRef}
          role="tablist"
          aria-label="Contest Problems"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-1 py-0.5"
        >
          {problems.map((item, index) => {
            const isCurrent = item.id === selectedProblemId;
            const status = statuses[item.id] ?? "unattempted";

            const statusLabel =
              status === "solved"
                ? "Passed"
                : status === "attempted"
                  ? "Attempted"
                  : "Unattempted";
            const tooltipText = `${String(item.position).padStart(2, "0")} · ${item.title} · ${statusLabel}`;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger
                  render={
                    <button
                      ref={(el) => {
                        pillRefs.current[item.id] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`problem-tab-${item.id}`}
                      aria-selected={isCurrent}
                      aria-controls={`problem-panel-${item.id}`}
                      aria-label={tooltipText}
                      tabIndex={isCurrent ? 0 : -1}
                      onClick={() => onSelectProblem(item.id)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className={cn(
                        "relative inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-2.5 text-xs font-medium tabular-nums select-none transition-all outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer",
                        // States:
                        // current: raised surface, primary text, 1px amber border
                        isCurrent
                          ? "bg-card text-foreground border border-amber-500 shadow-xs ring-1 ring-amber-500/25 font-bold"
                          // idle: muted text, subtle border
                          : "text-muted-foreground border border-border/70 bg-transparent hover:text-foreground hover:border-border hover:bg-muted/40",
                      )}
                    >
                      <span className="font-mono">{item.position}</span>

                      {/* attempted: small 6px amber dot at top-right inside pill bounds */}
                      {status === "attempted" ? (
                        <span
                          aria-hidden="true"
                          className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500 pointer-events-none"
                        />
                      ) : null}

                      {/* passed: green check replaces the number's dot */}
                      {status === "solved" ? (
                        <Check
                          aria-hidden="true"
                          className="absolute top-1 right-1 size-2.5 text-emerald-500 stroke-[3] pointer-events-none"
                        />
                      ) : null}
                    </button>
                  }
                />
                <TooltipContent side="bottom" sideOffset={8}>
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
