import { and, eq } from "drizzle-orm";
import { getDb, type Transaction } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { now as serverNow, addMinutes } from "@/lib/time";
import { lockAtDeadline, reopenDeadlineLockouts } from "@/lib/participants/lockout";
import { assertOrganizer, type EventActor } from "./manage";
import type { EventSummary } from "./queries";

/**
 * The shared clock from ADR 0002. Start, Extend, and End now are the only
 * writes that move it; participants never do.
 */

export type ClockOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

export type ClockResult = {
  event: EventSummary;
  /** False when the action was a repeat press and changed nothing. */
  changed: boolean;
};

/** The columns every clock write returns, so routes never re-read the row. */
const eventColumns = {
  id: events.id,
  title: events.title,
  status: events.status,
  durationMinutes: events.durationMinutes,
  code: events.code,
  startsAt: events.startsAt,
  deadlineAt: events.deadlineAt,
  endedAt: events.endedAt,
  e2bApiKey: events.e2bApiKey,
};

/**
 * Locks one event row for the acting organizer. Start takes this lock before
 * it flips the status, and every authoring write takes the same lock before it
 * edits problems, so an organizer cannot edit a problem at the very instant an
 * event goes live.
 *
 * Scoped by `createdBy = actor.id` so a second organizer account cannot start,
 * extend, or end another's event.
 */
export async function lockOwnedEvent(
  tx: Transaction,
  actor: EventActor,
  eventId: string,
): Promise<EventSummary> {
  const [row] = await tx
    .select(eventColumns)
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.createdBy, actor.id)))
    .for("update");

  if (!row) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }
  return row;
}

export type ExtendInput = ClockOptions & {
  /**
   * The deadline the organizer was looking at when they pressed Extend. A late
   * or repeated press that arrives after the clock already moved is rejected,
   * so an accidental double click does not add twenty minutes.
   */
  expectedDeadlineAt: Date;
};

/**
 * Extends `deadline_at` by 10 minutes. Available while `live`. It is also
 * available in `ended` IF AND ONLY IF the event ended by deadline; it reopens
 * participants locked out by the deadline, and leaves participants locked out
 * by `submitted` or `eliminated` alone.
 *
 * An event ended explicitly by "End now" cannot be extended.
 */
export async function extendDeadline(
  actor: EventActor,
  eventId: string,
  input: ExtendInput,
): Promise<ClockResult> {
  await assertOrganizer(actor, "extend an event");

  return getDb().transaction(async (tx) => {
    const current = await lockOwnedEvent(tx, actor, eventId);

    if (current.endedAt !== null) {
      throw new DomainError(
        "event_not_live",
        "An event ended by the organizer cannot be extended.",
        409,
      );
    }

    if (current.status === "draft" || !current.deadlineAt) {
      throw new DomainError(
        "event_not_live",
        "Extend is only available while the event is live.",
        400,
      );
    }

    if (current.deadlineAt.getTime() !== input.expectedDeadlineAt.getTime()) {
      return { event: current, changed: false };
    }

    const newDeadline = addMinutes(current.deadlineAt, 10);

    const [row] = await tx
      .update(events)
      .set({
        status: "live",
        deadlineAt: newDeadline,
      })
      .where(
        and(
          eq(events.id, eventId),
          eq(events.deadlineAt, current.deadlineAt),
        ),
      )
      .returning(eventColumns);

    if (row) {
      await reopenDeadlineLockouts(tx, eventId);
    }

    return { event: row ?? current, changed: Boolean(row) };
  });
}

/**
 * Starts the shared clock: `starts_at` is now, the deadline is now plus the
 * event's duration, and the Problem set is frozen because the event row's
 * status changes in the same transaction that held its lock.
 */
export async function startEvent(
  actor: EventActor,
  eventId: string,
  options: ClockOptions = {},
): Promise<ClockResult> {
  await assertOrganizer(actor, "start an event");
  const at = options.now ?? serverNow();

  return getDb().transaction(async (tx) => {
    const current = await lockOwnedEvent(tx, actor, eventId);

    if (current.status === "live") {
      // A repeat press (a double submit, or a reloaded tab) must not move the
      // clock a second time.
      return { event: current, changed: false };
    }
    if (current.status !== "draft") {
      throw new DomainError(
        "event_ended",
        "This event has already ended.",
        409,
      );
    }

    const [row] = await tx
      .update(events)
      .set({
        status: "live",
        startsAt: at,
        deadlineAt: addMinutes(at, current.durationMinutes),
      })
      .where(and(eq(events.id, eventId), eq(events.status, "draft")))
      .returning(eventColumns);

    return { event: row, changed: true };
  });
}

/**
 * Ends the event now: the deadline becomes this moment, the event becomes
 * `ended`, and every participant still unlocked is locked at that deadline in
 * the same transaction. An already-ended event is a no-op, so a double press
 * cannot rewrite the deadline or the lockout times.
 */
export async function endEvent(
  actor: EventActor,
  eventId: string,
  options: ClockOptions = {},
): Promise<ClockResult> {
  await assertOrganizer(actor, "end an event");
  const at = options.now ?? serverNow();

  return getDb().transaction(async (tx) => {
    const current = await lockOwnedEvent(tx, actor, eventId);

    if (current.status === "ended") {
      return { event: current, changed: false };
    }
    if (current.status !== "live") {
      throw new DomainError(
        "event_not_live",
        "This event has not started yet.",
      );
    }

    const [row] = await tx
      .update(events)
      .set({ status: "ended", deadlineAt: at, endedAt: at })
      .where(and(eq(events.id, eventId), eq(events.status, "live")))
      .returning(eventColumns);

    // The same conditional write the read path uses, scoped to the event. A
    // participant who already submitted keeps their reason and lockout time.
    await lockAtDeadline(tx, { eventId }, at);

    return { event: row ?? current, changed: Boolean(row) };
  });
}
