import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { events, problems, testCases } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { isOrganizerEmail } from "@/lib/env";
import {
  getProblem,
  listProblems,
  type ProblemSummary,
} from "./queries";

/** The acting account. Domain modules never read the session themselves. */
export type ProblemActor = {
  id: string;
  email: string;
};

export type SampleCaseInput = {
  input: string;
  expectedOutput: string;
};

export type ProblemInput = {
  title: string;
  /** Display-only label; nothing branches on it. */
  difficulty?: string | null;
  statementMd: string;
  sampleCases: SampleCaseInput[];
};

/** SPEC §4.2: exactly two Sample Test Cases per problem. */
export const SAMPLE_CASE_COUNT = 2;

type Transaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

/**
 * Locks the event row and re-checks draft status inside the write transaction.
 * Start (ticket 08) locks the same row, so a save cannot land after the freeze.
 */
async function lockDraftEvent(
  tx: Transaction,
  eventId: string,
): Promise<void> {
  const [row] = await tx
    .select({ status: events.status })
    .from(events)
    .where(eq(events.id, eventId))
    .for("update")
    .limit(1);

  if (!row) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }
  if (row.status !== "draft") {
    throw new DomainError(
      "event_not_draft",
      "Problems can only be edited while the event is a draft.",
    );
  }
}

function assertOrganizer(actor: ProblemActor, action: string): void {
  if (!isOrganizerEmail(actor.email)) {
    throw new DomainError(
      "not_organizer",
      `Only an organizer can ${action}.`,
      403,
    );
  }
}

/**
 * Resolves an event the actor owns. Authoring is only legal while the event is
 * a draft, so every write funnels through here.
 */
async function requireDraftEvent(
  actor: ProblemActor,
  eventId: string,
): Promise<{ id: string }> {
  const [row] = await getDb()
    .select({ id: events.id, status: events.status })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.createdBy, actor.id)))
    .limit(1);

  if (!row) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }
  if (row.status !== "draft") {
    throw new DomainError(
      "event_not_draft",
      "Problems can only be edited while the event is a draft.",
    );
  }
  return row;
}

function validateTitle(title: string): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed) {
    throw new DomainError("title_required", "Give the problem a title.");
  }
  return trimmed;
}

function validateStatement(statementMd: string): string {
  if (typeof statementMd !== "string" || !statementMd.trim()) {
    throw new DomainError(
      "statement_required",
      "Write the problem statement in Markdown.",
    );
  }
  // Store it as typed: leading indentation can be meaningful in Markdown.
  return statementMd;
}

function validateDifficulty(
  difficulty: string | null | undefined,
): string | null {
  const trimmed = typeof difficulty === "string" ? difficulty.trim() : "";
  return trimmed ? trimmed : null;
}

function validateSampleCases(
  sampleCases: SampleCaseInput[],
): SampleCaseInput[] {
  if (!Array.isArray(sampleCases) || sampleCases.length < SAMPLE_CASE_COUNT) {
    throw new DomainError(
      "sample_cases_missing",
      "A problem needs exactly two sample test cases. Add the missing one.",
    );
  }
  if (sampleCases.length > SAMPLE_CASE_COUNT) {
    throw new DomainError(
      "sample_cases_too_many",
      "A problem holds exactly two sample test cases.",
    );
  }
  for (const sampleCase of sampleCases) {
    if (
      !sampleCase ||
      typeof sampleCase.input !== "string" ||
      typeof sampleCase.expectedOutput !== "string"
    ) {
      throw new DomainError(
        "sample_case_invalid",
        "Each sample test case needs input text and expected output text.",
      );
    }
  }
  return sampleCases;
}

function validatedProblem(input: ProblemInput) {
  return {
    title: validateTitle(input.title),
    difficulty: validateDifficulty(input.difficulty),
    statementMd: validateStatement(input.statementMd),
    sampleCases: validateSampleCases(input.sampleCases),
  };
}

/** Appends a problem to the end of a draft event's problem set. */
export async function createProblem(
  actor: ProblemActor,
  eventId: string,
  input: ProblemInput,
): Promise<ProblemSummary> {
  assertOrganizer(actor, "author a problem");
  await requireDraftEvent(actor, eventId);
  const problem = validatedProblem(input);

  const problemId = await getDb().transaction(async (tx) => {
    await lockDraftEvent(tx, eventId);

    const [next] = await tx
      .select({
        position: sql<number>`coalesce(max(${problems.position}), 0)`,
      })
      .from(problems)
      .where(eq(problems.eventId, eventId));

    const [row] = await tx
      .insert(problems)
      .values({
        eventId,
        position: Number(next?.position ?? 0) + 1,
        title: problem.title,
        difficulty: problem.difficulty,
        statementMd: problem.statementMd,
      })
      .returning({ id: problems.id });

    await tx.insert(testCases).values(
      problem.sampleCases.map((sampleCase, index) => ({
        problemId: row.id,
        position: index + 1,
        input: sampleCase.input,
        expectedOutput: sampleCase.expectedOutput,
      })),
    );

    return row.id;
  });

  const created = await getProblem(problemId);
  if (!created) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }
  return created;
}

/**
 * Resolves a problem the actor may edit, by joining its event so ownership and
 * draft status are checked in the same read.
 */
async function requireDraftProblem(
  actor: ProblemActor,
  problemId: string,
): Promise<{ eventId: string }> {
  const [row] = await getDb()
    .select({
      eventId: problems.eventId,
      status: events.status,
    })
    .from(problems)
    .innerJoin(events, eq(problems.eventId, events.id))
    .where(and(eq(problems.id, problemId), eq(events.createdBy, actor.id)))
    .limit(1);

  if (!row) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }
  if (row.status !== "draft") {
    throw new DomainError(
      "event_not_draft",
      "Problems can only be edited while the event is a draft.",
    );
  }
  return { eventId: row.eventId };
}

/**
 * Replaces a problem's fields and both Sample Test Cases. The cases are
 * rewritten rather than patched so their order always follows the input.
 */
export async function updateProblem(
  actor: ProblemActor,
  problemId: string,
  input: ProblemInput,
): Promise<ProblemSummary> {
  assertOrganizer(actor, "edit a problem");
  const { eventId } = await requireDraftProblem(actor, problemId);
  const problem = validatedProblem(input);

  await getDb().transaction(async (tx) => {
    await lockDraftEvent(tx, eventId);

    await tx
      .update(problems)
      .set({
        title: problem.title,
        difficulty: problem.difficulty,
        statementMd: problem.statementMd,
      })
      .where(eq(problems.id, problemId));

    await tx.delete(testCases).where(eq(testCases.problemId, problemId));

    await tx.insert(testCases).values(
      problem.sampleCases.map((sampleCase, index) => ({
        problemId,
        position: index + 1,
        input: sampleCase.input,
        expectedOutput: sampleCase.expectedOutput,
      })),
    );
  });

  const updated = await getProblem(problemId);
  if (!updated) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }
  return updated;
}

export type MoveDirection = "up" | "down";

/**
 * Swaps a problem with its neighbour and renumbers the whole set. Positions
 * have no unique constraint, but the rewrite still happens in two phases so a
 * future constraint cannot turn a reorder into a duplicate-key failure.
 */
export async function moveProblem(
  actor: ProblemActor,
  problemId: string,
  direction: MoveDirection,
): Promise<ProblemSummary[]> {
  assertOrganizer(actor, "reorder problems");
  if (direction !== "up" && direction !== "down") {
    throw new DomainError(
      "direction_invalid",
      "A problem can only move up or down.",
    );
  }
  const { eventId } = await requireDraftProblem(actor, problemId);

  await getDb().transaction(async (tx) => {
    await lockDraftEvent(tx, eventId);

    const ordered = await tx
      .select({ id: problems.id })
      .from(problems)
      .where(eq(problems.eventId, eventId))
      .orderBy(asc(problems.position), asc(problems.createdAt));

    const index = ordered.findIndex((row) => row.id === problemId);
    if (index === -1) {
      throw new DomainError("problem_not_found", "Problem not found.", 404);
    }

    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return;

    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];

    await tx
      .update(problems)
      .set({ position: sql`${problems.position} + 1000` })
      .where(eq(problems.eventId, eventId));

    for (const [position, row] of next.entries()) {
      await tx
        .update(problems)
        .set({ position: position + 1 })
        .where(eq(problems.id, row.id));
    }
  });

  return listProblems(eventId);
}
