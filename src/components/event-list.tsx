import Link from "next/link";
import type { EventSummary } from "@/lib/events/queries";
import { EventStatusBadge } from "@/components/event-status-badge";
import { RegenerateCodeButton } from "@/components/regenerate-code-button";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function EventList({ events }: { events: EventSummary[] }) {
  if (events.length === 0) {
    return (
      <Empty className="border border-dashed border-border py-14">
        <EmptyHeader>
          <EmptyTitle>No events yet</EmptyTitle>
          <EmptyDescription>
            An event holds the problems, the join code, and the shared clock for
            one contest.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="label">Title</TableHead>
            <TableHead className="label">Status</TableHead>
            <TableHead className="label">Duration</TableHead>
            <TableHead className="label">Join code</TableHead>
            <TableHead className="label w-0 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-medium">{event.title}</TableCell>
              <TableCell>
                <EventStatusBadge status={event.status} />
              </TableCell>
              <TableCell className="text-muted-foreground tabular">
                {event.durationMinutes} min
              </TableCell>
              <TableCell>
                <span className="mono tracking-[0.18em]">{event.code}</span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {event.status === "draft" ? (
                    <RegenerateCodeButton eventId={event.id} />
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/events/${event.id}`} />}
                  >
                    Open
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
