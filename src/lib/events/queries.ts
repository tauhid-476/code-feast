import { and, desc, eq, ne } from "drizzle-orm";
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

/** One event, but only if the acting organizer owns it. */
export async function getOrganizerEvent(
  organizerId: string,
  eventId: string,
): Promise<EventSummary | null> {
  const [row] = await getDb()
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
    .where(and(eq(events.id, eventId), eq(events.createdBy, organizerId)))
    .limit(1);

  return row ?? null;
}

/**
 * Resolves a Join Code to the event it grants entry to. Ended events no longer
 * resolve, which is also what makes a regenerated code stop working at once.
 */
export async function findEventByJoinCode(
  code: string,
): Promise<EventSummary | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const [row] = await getDb()
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
    .where(and(eq(events.code, normalized), ne(events.status, "ended")))
    .limit(1);

  return row ?? null;
}

/**
 * The ended event a code used to name. Join asks for this only after the open
 * lookup misses, so a refusal can say "ended" instead of "never existed".
 */
export async function findEndedEventByJoinCode(
  code: string,
): Promise<EventSummary | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const [row] = await getDb()
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
    .where(and(eq(events.code, normalized), eq(events.status, "ended")))
    .orderBy(desc(events.createdAt))
    .limit(1);

  return row ?? null;
}
