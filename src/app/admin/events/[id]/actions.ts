"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import {
  createProblem,
  moveProblem,
  updateProblem,
  type MoveDirection,
  type ProblemInput,
} from "@/lib/problems/manage";

export type ProblemActionState = { error: string } | { ok: true };

function authoringPath(eventId: string): string {
  return `/admin/events/${eventId}`;
}

export async function createProblemAction(
  eventId: string,
  input: ProblemInput,
): Promise<ProblemActionState> {
  const organizer = await requireOrganizer();

  try {
    await createProblem(
      { id: organizer.id, email: organizer.email },
      eventId,
      input,
    );
    revalidatePath(authoringPath(eventId));
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProblemAction(
  eventId: string,
  problemId: string,
  input: ProblemInput,
): Promise<ProblemActionState> {
  const organizer = await requireOrganizer();

  try {
    await updateProblem(
      { id: organizer.id, email: organizer.email },
      problemId,
      input,
    );
    revalidatePath(authoringPath(eventId));
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveProblemAction(
  eventId: string,
  problemId: string,
  direction: MoveDirection,
): Promise<ProblemActionState> {
  const organizer = await requireOrganizer();

  try {
    await moveProblem(
      { id: organizer.id, email: organizer.email },
      problemId,
      direction,
    );
    revalidatePath(authoringPath(eventId));
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
