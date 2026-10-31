import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileCode, Timer } from "lucide-react";
import { EventSettingsDialog } from "@/components/event-settings-dialog";
import { EventStatusBadge } from "@/components/event-status-badge";
import { ProblemSet } from "@/components/problem-set";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireOrganizer } from "@/lib/auth/guards";
import { figuresStorageConfigured } from "@/lib/env";
import { getOrganizerEvent } from "@/lib/events/queries";
import { listProblems } from "@/lib/problems/queries";

export const dynamic = "force-dynamic";

export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;

  const event = await getOrganizerEvent(organizer.id, id);
  if (!event) notFound();

  const problems = await listProblems(event.id);
  const editable = event.status === "draft";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={<Link href="/admin/events" />}
        >
          <ArrowLeft data-icon="inline-start" />
          Events
        </Button>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {event.title}
          </h1>
          <EventStatusBadge status={event.status} />
          <div className="ml-auto flex items-center gap-2">
            {editable ? (
              <EventSettingsDialog
                eventId={event.id}
                currentTitle={event.title}
                currentDurationMinutes={event.durationMinutes}
                hasCustomE2bKey={Boolean(event.e2bApiKey)}
              />
            ) : null}
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/events/${event.id}/live`} />}
            >
              <Timer data-icon="inline-start" />
              Live controls
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/events/${event.id}/review`} />}
            >
              <FileCode data-icon="inline-start" />
              Review
            </Button>
          </div>
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
          <div className="flex items-baseline gap-2">
            <dt className="label">Problems</dt>
            <dd className="text-sm tabular">{problems.length}</dd>
          </div>
        </dl>
      </header>

      {editable ? null : (
        <Alert>
          <AlertTitle>
            {event.status === "live"
              ? "This event is live."
              : "This event has ended."}
          </AlertTitle>
          <AlertDescription>
            Problems can only be authored while the event is a draft. The set is
            read-only now.
          </AlertDescription>
        </Alert>
      )}

      <ProblemSet
        eventId={event.id}
        editable={editable}
        figuresEnabled={figuresStorageConfigured()}
        problems={problems}
      />
    </div>
  );
}
