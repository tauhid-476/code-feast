"use client";

import { useState, useTransition } from "react";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  reinstateParticipantAction,
  type ReinstateActionState,
} from "@/app/admin/events/[id]/live/actions";
import { Badge } from "@/components/legacy-ui/badge";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Spinner } from "@/components/legacy-ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/legacy-ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/legacy-ui/tooltip";
import type { Participant } from "@/lib/participants/lockout";

/**
 * Lists participants eliminated by the strike counter and allows the organizer
 * to reinstate them while the event is running (SPEC §6). Reinstatement is
 * disabled once the event has ended.
 */
export function EliminatedParticipantsCard({
  eventId,
  eliminated,
  eventEnded,
}: {
  eventId: string;
  eliminated: Participant[];
  eventEnded: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleReinstate(participantId: string) {
    if (eventEnded) return;
    setPendingId(participantId);
    startTransition(async () => {
      try {
        const result: ReinstateActionState = await reinstateParticipantAction(
          eventId,
          participantId,
        );
        if ("error" in result) {
          toast.error(result.error);
        } else {
          toast.success("Participant reinstated.");
        }
      } catch {
        toast.error("Failed to reinstate participant.");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle>Eliminated participants</CardTitle>
          <CardDescription>
            Participants locked out by anti-cheat strikes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eliminated.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No participants have been eliminated.
            </p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Strikes</TableHead>
                    <TableHead>Eliminated at</TableHead>
                    <TableHead className="text-end">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eliminated.map((participant) => {
                    const isPending = pendingId === participant.id;
                    const isDisabled = eventEnded || isPending;

                    const reinstateButton = (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDisabled}
                        onClick={() => handleReinstate(participant.id)}
                      >
                        {isPending ? (
                          <Spinner />
                        ) : (
                          <RotateCcw data-icon="inline-start" />
                        )}
                        Reinstate
                      </Button>
                    );

                    return (
                      <TableRow key={participant.id}>
                        <TableCell>
                          <div className="font-medium">
                            {participant.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {participant.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            <ShieldAlert data-icon="inline-start" />
                            <span className="mono tabular">
                              {participant.strikes} strikes
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono tabular">
                          {participant.lockedAt
                            ? new Date(participant.lockedAt).toLocaleTimeString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          {eventEnded ? (
                            <Tooltip>
                              <TooltipTrigger render={<span tabIndex={0} />}>
                                {reinstateButton}
                              </TooltipTrigger>
                              <TooltipContent>
                                Reinstatement is disabled once the event has
                                ended.
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            reinstateButton
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {eventEnded ? (
                <p className="text-xs text-muted-foreground">
                  Reinstatement is disabled once the event has ended.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
