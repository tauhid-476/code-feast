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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Join code</TableHead>
          <TableHead className="w-0 text-right">Actions</TableHead>
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
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/events/${event.id}`}>Open</Link>
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
