import type { ReactNode } from "react";
import { EventCountdown } from "@/components/event-countdown";
import { Card, CardContent } from "@/components/legacy-ui/card";
import type { EventHealth } from "@/lib/events/live";

function Stat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label">{label}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}

/**
 * The health strip from SPEC §4.4. All numbers are server reads; only the
 * countdown ticks, and it is a projection of the server's remaining seconds.
 */
export function EventHealthStrip({
  status,
  health,
}: {
  status: string;
  health: EventHealth;
}) {
  let remaining: ReactNode;
  if (status === "draft" || health.secondsRemaining === null) {
    remaining = <span className="text-base text-muted-foreground">Not started</span>;
  } else if (status === "ended") {
    remaining = <span className="text-base text-muted-foreground">Ended</span>;
  } else if (health.secondsRemaining === 0) {
    remaining = (
      <span className="text-base text-muted-foreground">Deadline reached</span>
    );
  } else {
    remaining = <EventCountdown seconds={health.secondsRemaining} />;
  }

  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-5">
          <Stat label="Joined">
            <span className="text-2xl font-medium">{health.participants}</span>
          </Stat>
          <Stat label="Solving">
            <span className="text-2xl font-medium">{health.solving}</span>
          </Stat>
          <Stat label="Locked">
            <span className="text-2xl font-medium">{health.locked}</span>
          </Stat>
          <Stat label="Sandboxes ready">
            <span className="text-2xl font-medium">{health.readySandboxes}</span>
          </Stat>
          <Stat label="Time remaining">{remaining}</Stat>
        </dl>
      </CardContent>
    </Card>
  );
}
