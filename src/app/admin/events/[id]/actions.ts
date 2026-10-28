"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOrganizer } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import { testProblem } from "@/lib/problems/test";
import { scheduleReplenish } from "@/lib/runner/pool";
import type { RunResult } from "@/lib/runner/run";
import {
  createProblem,
  moveProblem,
  saveProblemStarter,
  updateProblem,
  type MoveDirection,
  type ProblemInput,
  type StarterPairInput,
} from "@/lib/problems/manage";

export type ProblemActionState = { error: string } | { ok: true };
export type TestProblemActionState = { error: string } | { result: RunResult };

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

export async function saveProblemStarterAction(
  eventId: string,
  problemId: string,
  language: string,
  input: StarterPairInput,
): Promise<ProblemActionState> {
  const organizer = await requireOrganizer();

  try {
    await saveProblemStarter(
      { id: organizer.id, email: organizer.email },
      problemId,
      language,
      input,
    );
    revalidatePath(authoringPath(eventId));
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * The "Test this problem" Run. It is a read, so it revalidates nothing: the
 * organizer pastes a solution, the server appends the Harness, and the panel
 * renders the same shape a participant's Run returns.
 */
export async function testProblemAction(
  eventId: string,
  problemId: string,
  language: string,
  code: string,
): Promise<TestProblemActionState> {
  const organizer = await requireOrganizer();

  try {
    const result = await testProblem(
      { id: organizer.id, email: organizer.email },
      { eventId, problemId, language, code },
    );

    // A Run is a request that can notice the pool is short; top it up after
    // the response rather than making the organizer wait (SPEC §7).
    after(scheduleReplenish());

    return { result };
  } catch (error) {
    return actionError(error);
  }
}
