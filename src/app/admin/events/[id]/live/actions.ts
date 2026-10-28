"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import { endEvent, extendDeadline, startEvent } from "@/lib/events/clock";

export type ClockActionState =
  | { error: string }
  | { ok: true; changed: boolean };

function revalidateEvent(eventId: string): void {
  revalidatePath(`/admin/events/${eventId}/live`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/admin/events");
}

export async function startEventAction(
  eventId: string,
): Promise<ClockActionState> {
  const organizer = await requireOrganizer();

  try {
    const { changed } = await startEvent(
      { id: organizer.id, email: organizer.email },
      eventId,
    );
    revalidateEvent(eventId);
    return { ok: true, changed };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * The deadline is passed back with the press: extending is relative to what
 * the organizer saw, so a double submit moves the clock once.
 */
export async function extendDeadlineAction(
  eventId: string,
  expectedDeadlineAt: string,
): Promise<ClockActionState> {
  const organizer = await requireOrganizer();
  const expected = new Date(expectedDeadlineAt);
  if (Number.isNaN(expected.getTime())) {
    return { error: "That deadline is not valid. Reload the page." };
  }

  try {
    const { changed } = await extendDeadline(
      { id: organizer.id, email: organizer.email },
      eventId,
      { expectedDeadlineAt: expected },
    );
    revalidateEvent(eventId);
    return { ok: true, changed };
  } catch (error) {
    return actionError(error);
  }
}

export async function endEventAction(
  eventId: string,
): Promise<ClockActionState> {
  const organizer = await requireOrganizer();

  try {
    const { changed } = await endEvent(
      { id: organizer.id, email: organizer.email },
      eventId,
    );
    revalidateEvent(eventId);
    return { ok: true, changed };
  } catch (error) {
    return actionError(error);
  }
}
