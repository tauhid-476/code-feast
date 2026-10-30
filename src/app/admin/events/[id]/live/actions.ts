"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOrganizer } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import { endEvent, extendDeadline, startEvent } from "@/lib/events/clock";
import { reinstateParticipant } from "@/lib/participants/lockout";
import { scheduleReplenish } from "@/lib/runner/pool";

export type ClockActionState =
  | { error: string }
  | { ok: true; changed: boolean };

export type ReinstateActionState =
  | { error: string; code?: string }
  | { ok: true };

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
    // Start is the moment the pool stops being hypothetical: warm it to
    // POOL_TARGET so the first participant's Run does not pay for the cold
    // start (SPEC §7). `after()` outlives the response, which is what the
    // twenty creations at E2B's one-per-second pace need.
    after(scheduleReplenish());
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

export async function reinstateParticipantAction(
  eventId: string,
  participantId: string,
): Promise<ReinstateActionState> {
  const organizer = await requireOrganizer();

  try {
    await reinstateParticipant(
      { id: organizer.id, email: organizer.email },
      eventId,
      participantId,
    );
    revalidateEvent(eventId);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
