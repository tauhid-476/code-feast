import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EliminatedParticipantsCard } from "@/components/eliminated-participants";
import { EventClockControls } from "@/components/event-clock-controls";
import { EventHealthStrip } from "@/components/event-health-strip";
import { EventStatusBadge } from "@/components/event-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireOrganizer } from "@/lib/auth/guards";
import { getEventHealth } from "@/lib/events/live";

export const dynamic = "force-dynamic";

export default async function AdminEventLivePage({
  params,
}: PageProps<"/admin/events/[id]/live">) {
  const organizer = await requireOrganizer();
  const { id } = await params;

  const view = await getEventHealth(organizer.id, id);
  if (!view) notFound();

  const { event, health, eliminated } = view;
  const deadlineReached =
    event.status === "live" && health.secondsRemaining === 0;
  const eventEnded =
    event.status === "ended" ||
    (event.deadlineAt != null && health.secondsRemaining === 0);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href={`/admin/events/${event.id}`} />}
        >
          <ArrowLeft data-icon="inline-start" />
          Problems
        </Button>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {event.title}
          </h1>
          <EventStatusBadge status={event.status} />
        </div>

        <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <div className="flex items-baseline gap-2">
            <dt className="label">Join code</dt>
            <dd className="mono text-sm tracking-[0.18em]">{event.code}</dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="label">Duration</dt>
            <dd className="text-sm tabular">{event.durationMinutes} min</dd>
          </div>
        </dl>
      </header>

      <EventHealthStrip status={event.status} health={health} />

      {event.status === "draft" ? (
        <Alert>
          <AlertTitle>Not started</AlertTitle>
          <AlertDescription>
            The lobby is open. Problems are invisible to participants and can
            still be edited until you press Start.
          </AlertDescription>
        </Alert>
      ) : null}

      {deadlineReached ? (
        <Alert variant="destructive">
          <AlertTitle>The deadline has passed</AlertTitle>
          <AlertDescription>
            Participants are locked at the deadline as they read the event. End
            the event when the room is done, or extend the deadline by 10
            minutes.
          </AlertDescription>
        </Alert>
      ) : null}

      {event.status === "ended" ? (
        <Alert>
          <AlertTitle>This event has ended</AlertTitle>
          <AlertDescription>
            {event.endedAt
              ? "This event was ended manually by the organizer. The problem set is read-only."
              : "The deadline was reached. You can extend by 10 minutes to reopen deadline-locked participants."}
          </AlertDescription>
        </Alert>
      ) : null}

      <EventClockControls
        eventId={event.id}
        status={event.status}
        participants={health.participants}
        durationMinutes={event.durationMinutes}
        deadlineAt={event.deadlineAt?.toISOString() ?? null}
        endedAt={event.endedAt?.toISOString() ?? null}
        deadlineReached={deadlineReached}
      />

      <EliminatedParticipantsCard
        eventId={event.id}
        eliminated={eliminated}
        eventEnded={eventEnded}
      />
    </div>
  );
}
