"use client";

import { useState, useTransition } from "react";
import { Ban, Play, Timer } from "lucide-react";
import { toast } from "sonner";
import {
  endEventAction,
  extendDeadlineAction,
  startEventAction,
  type ClockActionState,
} from "@/app/admin/events/[id]/live/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardText, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { endConfirmationText, startConfirmationText } from "@/lib/events/copy";

/**
 * The three clock actions from SPEC §4.4. Start and End now confirm; Extend is
 * repeatable and sends the deadline it rendered so a double press is a no-op.
 * Extending an ended event is available only if it ended at deadline, and reopens
 * participants locked by deadline.
 */
export function EventClockControls({
  eventId,
  status,
  participants,
  durationMinutes,
  deadlineAt,
  endedAt,
  deadlineReached,
}: {
  eventId: string;
  status: string;
  participants: number;
  durationMinutes: number;
  deadlineAt: string | null;
  endedAt?: string | null;
  deadlineReached?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  function settle(
    result: ClockActionState,
    success: string,
    noop: string,
  ): boolean {
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    if (!result.changed) {
      toast.info(noop);
      return true;
    }
    toast.success(success);
    return true;
  }

  function start() {
    startTransition(async () => {
      const result = await startEventAction(eventId);
      if (settle(result, "The event is live.", "The event was already started.")) {
        setStarting(false);
      }
    });
  }

  function extend() {
    if (!deadlineAt) return;
    startTransition(async () => {
      const result = await extendDeadlineAction(eventId, deadlineAt);
      settle(result, "Added 10 minutes.", "The deadline already moved.");
    });
  }

  function end() {
    startTransition(async () => {
      const result = await endEventAction(eventId);
      if (settle(result, "The event has ended.", "The event had already ended.")) {
        setEnding(false);
      }
    });
  }

  return (
    <>
      <Card className="backdrop-blur-none sm:opacity-100">
        <CardBody className="gap-3">
          <CardTitle>Clock</CardTitle>
          <CardText className="line-clamp-none">
            One deadline for everyone. Participants never control it.
          </CardText>

          {status === "draft" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Nothing is visible to participants until you start.
              </p>
              <Button onClick={() => setStarting(true)} disabled={pending}>
                <Play />
                Start event
              </Button>
            </div>
          ) : null}

          {status === "live" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {deadlineReached
                  ? "The deadline was reached. Extending adds ten minutes and reopens participants locked by deadline."
                  : "Extend adds ten minutes to the shared deadline."}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={extend}
                  disabled={pending || !deadlineAt}
                >
                  <Timer />
                  Extend +10
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setEnding(true)}
                  disabled={pending}
                >
                  <Ban />
                  End now
                </Button>
              </div>
            </div>
          ) : null}

          {status === "ended" ? (
            endedAt ? (
              <p className="text-sm text-muted-foreground">
                This event was ended manually by the organizer. It cannot be
                extended.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  The event reached its deadline. Extending adds ten minutes and
                  reopens participants locked by deadline.
                </p>
                <Button
                  variant="outline"
                  onClick={extend}
                  disabled={pending || !deadlineAt}
                >
                  <Timer />
                  Extend +10
                </Button>
              </div>
            )
          ) : null}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={starting}
        title="Start this event?"
        confirmLabel="Start event"
        busyLabel="Starting…"
        tone="neutral"
        busy={pending}
        onConfirm={start}
        onCancel={() => setStarting(false)}
      >
        {startConfirmationText(participants, durationMinutes)}
      </ConfirmDialog>

      <ConfirmDialog
        open={ending}
        title="End this event now?"
        confirmLabel="End now"
        busyLabel="Ending…"
        busy={pending}
        onConfirm={end}
        onCancel={() => setEnding(false)}
      >
        {endConfirmationText()}
      </ConfirmDialog>
    </>
  );
}
