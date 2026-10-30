"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import {
  setParticipantShortlist,
  toggleParticipantShortlist,
} from "@/lib/review/manage";
import {
  getParticipantSubmission,
  type ParticipantSubmissionDetail,
} from "@/lib/review/queries";

export type ShortlistActionState =
  | { error: string; code?: string }
  | { ok: true; shortlisted: boolean };

export type SubmissionDetailActionState =
  | { error: string; code?: string }
  | { ok: true; detail: ParticipantSubmissionDetail };

function revalidateReview(eventId: string): void {
  revalidatePath(`/admin/events/${eventId}/review`);
  revalidatePath(`/admin/events/${eventId}`);
}

export async function toggleShortlistAction(
  eventId: string,
  participantId: string,
): Promise<ShortlistActionState> {
  const organizer = await requireOrganizer();

  try {
    const result = await toggleParticipantShortlist(
      { id: organizer.id, email: organizer.email },
      eventId,
      participantId,
    );
    revalidateReview(eventId);
    return { ok: true, shortlisted: result.shortlisted };
  } catch (error) {
    return actionError(error);
  }
}

export async function setShortlistAction(
  eventId: string,
  participantId: string,
  shortlisted: boolean,
): Promise<ShortlistActionState> {
  const organizer = await requireOrganizer();

  try {
    const result = await setParticipantShortlist(
      { id: organizer.id, email: organizer.email },
      eventId,
      participantId,
      shortlisted,
    );
    revalidateReview(eventId);
    return { ok: true, shortlisted: result.shortlisted };
  } catch (error) {
    return actionError(error);
  }
}

export async function loadParticipantSubmissionAction(
  eventId: string,
  participantId: string,
): Promise<SubmissionDetailActionState> {
  const organizer = await requireOrganizer();

  try {
    const detail = await getParticipantSubmission(
      { id: organizer.id, email: organizer.email },
      eventId,
      participantId,
    );
    return { ok: true, detail };
  } catch (error) {
    return actionError(error);
  }
}
