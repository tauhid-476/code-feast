import { CircleAlert } from "lucide-react";
import {
  languageCoverage,
  type StarterPresence,
} from "@/lib/problems/coverage";

/**
 * The authoring surface's readiness line for one Problem. Nothing here reaches
 * a participant: a missing Starter Code is a pre-start warning for the
 * Organizer only.
 */
export function ProblemCompleteness({
  starters,
}: {
  starters: StarterPresence[];
}) {
  const coverage = languageCoverage(starters);

  if (coverage.complete) {
    return <span className="text-muted-foreground">All three languages ready</span>;
  }

  return (
    <span className="flex items-start gap-1.5 text-destructive">
      <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0" />
      <span>{coverage.summary}</span>
    </span>
  );
}
