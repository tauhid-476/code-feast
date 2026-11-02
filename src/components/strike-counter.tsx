import { ShieldAlert } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { STRIKE_LIMIT } from "@/lib/violations/kinds";

/**
 * The strike count SPEC §6 requires to be always visible ("1 of 3"). It is
 * permanent for the Event and arrives from the server on every page load, so it
 * survives a refresh and a re-entry of the Join Code; the contest page updates
 * it in place as new strikes land.
 *
 * At the limit before the last strike it turns destructive: two of three is the
 * moment a participant should notice, not a count they read for the first time
 * after being eliminated.
 */
export function StrikeCounter({
  strikes,
  limit = STRIKE_LIMIT,
}: {
  strikes: number;
  limit?: number;
}) {
  const dangerous = strikes >= limit - 1;

  return (
    <Chip
      tone={dangerous ? "danger" : "default"}
      aria-live="polite"
      aria-label={`Strikes: ${strikes} of ${limit}`}
    >
      <ShieldAlert className="size-3" aria-hidden="true" />
      <span className="label">Strikes</span>
      <span className={cn("mono tabular", dangerous && "font-semibold")}>
        {strikes} of {limit}
      </span>
    </Chip>
  );
}
