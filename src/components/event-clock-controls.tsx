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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { endConfirmationText, startConfirmationText } from "@/lib/events/copy";

/**
 * The three clock actions from SPEC §4.4. Start and End now confirm; Extend is
 * repeatable and sends the deadline it rendered so a double press is a no-op.
 */
export function EventClockControls({
  eventId,
  status,
  participants,
  durationMinutes,
  deadlineAt,
}: {
  eventId: string;
  status: string;
  participants: number;
  durationMinutes: number;
  deadlineAt: string | null;
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
    <Card>
      <CardHeader>
        <CardTitle>Clock</CardTitle>
        <CardDescription>
          One deadline for everyone. Participants never control it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "draft" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Nothing is visible to participants until you start.
            </p>
            <Button onClick={() => setStarting(true)} disabled={pending}>
              <Play data-icon="inline-start" />
              Start event
            </Button>
          </div>
        ) : null}

        {status === "live" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Extend adds ten minutes to the shared deadline.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={extend}
                disabled={pending || !deadlineAt}
              >
                <Timer data-icon="inline-start" />
                Extend +10
              </Button>
              <Button
                variant="destructive"
                onClick={() => setEnding(true)}
                disabled={pending}
              >
                <Ban data-icon="inline-start" />
                End now
              </Button>
            </div>
          </div>
        ) : null}

        {status === "ended" ? (
          <p className="text-sm text-muted-foreground">
            The clock has stopped. The problem set is read-only.
          </p>
        ) : null}
      </CardContent>

      <AlertDialog open={starting} onOpenChange={setStarting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start this event?</AlertDialogTitle>
            <AlertDialogDescription>
              {startConfirmationText(participants, durationMinutes)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={start} disabled={pending}>
              {pending ? <Spinner /> : <Play data-icon="inline-start" />}
              Start event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={ending} onOpenChange={setEnding}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this event now?</AlertDialogTitle>
            <AlertDialogDescription>
              {endConfirmationText()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={end}
              disabled={pending}
            >
              {pending ? <Spinner /> : <Ban data-icon="inline-start" />}
              End now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
