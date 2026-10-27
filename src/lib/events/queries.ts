import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { events } from "@/lib/db/schema";

export type EventSummary = {
  id: string;
  title: string;
  status: string;
  durationMinutes: number;
  code: string;
  startsAt: Date | null;
  deadlineAt: Date | null;
};

/**
 * Events belonging to one organizer, newest first. Scoped by `created_by` so a
 * second organizer account never sees another's events.
 */
export async function listOrganizerEvents(
  organizerId: string,
): Promise<EventSummary[]> {
  return getDb()
    .select({
      id: events.id,
      title: events.title,
      status: events.status,
      durationMinutes: events.durationMinutes,
      code: events.code,
      startsAt: events.startsAt,
      deadlineAt: events.deadlineAt,
    })
    .from(events)
    .where(eq(events.createdBy, organizerId))
    .orderBy(desc(events.createdAt));
}
