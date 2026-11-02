import type { ReactNode } from "react";
import { Badge } from "@/components/legacy-ui/badge";
import { Card, CardContent } from "@/components/legacy-ui/card";
import { Separator } from "@/components/legacy-ui/separator";
import type { LockoutReason } from "@/lib/participants/lockout";
import { elapsedSeconds, formatDuration } from "@/lib/time";

const REASON_LABEL: Record<LockoutReason, string> = {
  submitted: "Submitted",
  deadline: "Deadline",
  eliminated: "Eliminated",
};

const REASON_TEXT: Record<LockoutReason, string> = {
  submitted: "You submitted, so your contest is over.",
  deadline: "The shared clock reached its deadline.",
  eliminated: "You were locked out after three strikes.",
};

/**
 * The terminal screen (SPEC §5.8). It shows why the contest is over and how
 * long the participant worked; it is given no code, so there is nothing here
 * to view or edit. The only way on is to sign out.
 */
export function LockedScreen({
  eventTitle,
  participantName,
  reason,
  joinedAt,
  lockedAt,
  action,
}: {
  eventTitle: string;
  participantName: string;
  reason: LockoutReason | null;
  joinedAt: Date;
  lockedAt: Date | null;
  /** The page's sign-out control; kept out so the screen can render alone. */
  action?: ReactNode;
}) {
  const elapsed = lockedAt ? elapsedSeconds(joinedAt, lockedAt) : 0;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="label">Locked</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {eventTitle}
            </h1>
          </div>
          {action}
        </header>

        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {reason ? REASON_LABEL[reason] : "Ended"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {participantName}
                </span>
              </div>
              <p className="text-sm font-medium">Your contest is locked.</p>
              <p className="text-sm text-muted-foreground">
                {reason ? REASON_TEXT[reason] : "This event has ended."}
              </p>
            </div>

            <Separator />

            <div className="flex items-baseline justify-between gap-4">
              <span className="label">Elapsed</span>
              <span className="mono tabular text-lg text-foreground">
                {formatDuration(elapsed)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Your code is frozen. It can no longer be viewed or changed.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
