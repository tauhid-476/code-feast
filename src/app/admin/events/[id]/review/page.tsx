import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Timer } from "lucide-react";
import { EventStatusBadge } from "@/components/event-status-badge";
import { ReviewDashboard } from "@/components/review-dashboard";
import { Button } from "@/components/ui/button";
import { requireOrganizer } from "@/lib/auth/guards";
import {
  getParticipantSubmission,
  getReviewDashboard,
  type ParticipantSubmissionDetail,
} from "@/lib/review/queries";

export const dynamic = "force-dynamic";

export default async function AdminEventReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ participant?: string }>;
}) {
  const organizer = await requireOrganizer();
  const { id } = await params;
  const { participant: selectedParticipantId } = await searchParams;

  const actor = { id: organizer.id, email: organizer.email };

  let dashboard;
  try {
    dashboard = await getReviewDashboard(actor, id);
  } catch {
    notFound();
  }

  const { event, participants } = dashboard;

  let initialSelectedDetail: ParticipantSubmissionDetail | null = null;
  if (selectedParticipantId) {
    try {
      initialSelectedDetail = await getParticipantSubmission(
        actor,
        id,
        selectedParticipantId,
      );
    } catch {
      // If invalid participant id, ignore and show unselected dashboard
      initialSelectedDetail = null;
    }
  }

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
          Event details
        </Button>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {event.title}
          </h1>
          <EventStatusBadge status={event.status} />

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/events/${event.id}`} />}
            >
              <BookOpen data-icon="inline-start" />
              Problems
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/events/${event.id}/live`} />}
            >
              <Timer data-icon="inline-start" />
              Live controls
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
        </dl>
      </header>

      <ReviewDashboard
        eventId={event.id}
        initialParticipants={participants}
        initialSelectedDetail={initialSelectedDetail}
      />
    </div>
  );
}
