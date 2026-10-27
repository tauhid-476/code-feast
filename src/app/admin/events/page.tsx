import { requireOrganizer } from "@/lib/auth/guards";
import { listOrganizerEvents } from "@/lib/events/queries";
import { CreateEventForm } from "@/components/create-event-form";
import { EventList } from "@/components/event-list";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const organizer = await requireOrganizer();
  const events = await listOrganizerEvents(organizer.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every contest you run starts here.
          </p>
        </div>
      </div>
      <CreateEventForm />
      <EventList events={events} />
    </div>
  );
}
