import type { ReactNode } from "react";
import { MonitorSmartphone } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Separator } from "@/components/ui/separator";
import { sessionTakeoverText } from "@/lib/contest/copy";

/**
 * What the older of two live sessions sees (SPEC §6, SPEC §10). It is a
 * terminal state, not an error banner: the editor is gone, because Run, Submit,
 * and autosave are all refused for this session. The copy names what happened
 * and what it cost, so the Participant does not read a silent failure.
 *
 * The page is given no code and no drafts, so there is nothing here to leak.
 */
export function SessionTakeover({
  eventTitle,
  participantName,
  action,
}: {
  eventTitle: string;
  participantName: string;
  /** The page's sign-out control; kept out so the screen can render alone. */
  action?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="label">Read-only</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {eventTitle}
            </h1>
          </div>
          {action}
        </header>

        <Card className="backdrop-blur-none sm:opacity-100">
          <CardBody className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="danger">
                <MonitorSmartphone className="size-3" aria-hidden="true" />
                Newer tab
              </Chip>
              <span className="text-xs text-muted-foreground">
                {participantName}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                A newer tab took over this contest.
              </p>
              <p className="text-sm text-muted-foreground">
                {sessionTakeoverText()}
              </p>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">
              Keep working in the newer tab. Signing out here will not undo the
              strike, and reloading this page will not take the contest back.
            </p>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
