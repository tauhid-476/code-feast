"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
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
import { rerunSubmission } from "@/lib/review/rerun";
import { scheduleReplenish } from "@/lib/runner/pool";
import type { RunResult } from "@/lib/runner/run";

export type ShortlistActionState =
  | { error: string; code?: string }
  | { ok: true; shortlisted: boolean };

export type SubmissionDetailActionState =
  | { error: string; code?: string }
  | { ok: true; detail: ParticipantSubmissionDetail };

export type RerunSubmissionActionState =
  | { error: string; code?: string }
  | { ok: true; result: RunResult };

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

export async function rerunSubmissionAction(
  eventId: string,
  participantId: string,
  problemId: string,
): Promise<RerunSubmissionActionState> {
  const organizer = await requireOrganizer();

  // A Run is a request that can notice the pool is short; top it up after the
  // response rather than making the organizer wait (SPEC §7). Registered before
  // the Run so a busy or failed Run still leaves the pool filling.
  after(scheduleReplenish());

  try {
    const result = await rerunSubmission(
      { id: organizer.id, email: organizer.email },
      { eventId, participantId, problemId },
    );
    return { ok: true, result };
  } catch (error) {
    return actionError(error);
  }
}
