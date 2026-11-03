import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  events,
  problemStarters,
  problems,
  testCases,
} from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import {
  reconcileFiguresInTransaction,
  removeFigureObjects,
} from "@/lib/figures/manage";
import { isApprovedOrganizer } from "@/lib/organizers/whitelist";
import { LANGUAGE_LABELS, isLanguage, type Language } from "@/lib/languages";
import {
  getProblem,
  listProblems,
  type ProblemSummary,
  type TestCaseVariable,
} from "./queries";

/** The acting account. Domain modules never read the session themselves. */
export type ProblemActor = {
  id: string;
  email: string;
};

export type SampleCaseInput = {
  input?: string;
  expectedOutput: string;
  variables?: TestCaseVariable[] | null;
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

async function assertOrganizer(actor: ProblemActor, action: string): Promise<void> {
  if (!(await isApprovedOrganizer(actor.email))) {
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

export type ValidatedSampleCase = {
  input: string;
  expectedOutput: string;
  variables: TestCaseVariable[] | null;
};

function validateSampleCases(
  sampleCases: SampleCaseInput[],
): ValidatedSampleCase[] {
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
  return sampleCases.map((sampleCase) => {
    if (!sampleCase || typeof sampleCase.expectedOutput !== "string") {
      throw new DomainError(
        "sample_cases_malformed",
        "Sample test cases must specify input and expected output.",
      );
    }

    let variables: TestCaseVariable[] | null = null;
    if (Array.isArray(sampleCase.variables) && sampleCase.variables.length > 0) {
      for (const v of sampleCase.variables) {
        if (!v || typeof v.name !== "string" || typeof v.value !== "string") {
          throw new DomainError(
            "sample_cases_malformed",
            "Variable parameters must have a name and value.",
          );
        }
      }
      variables = sampleCase.variables.map((v) => ({
        name: v.name.trim(),
        value: v.value,
      }));
    }

    let input = typeof sampleCase.input === "string" ? sampleCase.input : "";
    if (!input && variables && variables.length > 0) {
      input = variables.map((v) => v.value).join("\n");
    }

    if (typeof input !== "string" || (!input && !variables)) {
      throw new DomainError(
        "sample_cases_malformed",
        "Sample test cases must specify input and expected output.",
      );
    }

    return {
      input,
      expectedOutput: sampleCase.expectedOutput,
      variables,
    };
  });
}

function validatedProblem(input: ProblemInput) {
  return {
    title: validateTitle(input?.title),
    difficulty: validateDifficulty(input?.difficulty),
    statementMd: validateStatement(input?.statementMd),
    sampleCases: validateSampleCases(input?.sampleCases),
  };
}

/**
 * Creates a problem at the end of the event's sequence with both of its Sample
 * Test Cases. The sequence uses a contiguous 1-based index (SPEC §4.1).
 */
export async function createProblem(
  actor: ProblemActor,
  eventId: string,
  input: ProblemInput,
): Promise<ProblemSummary> {
  await assertOrganizer(actor, "author a problem");
  await requireDraftEvent(actor, eventId);
  const problem = validatedProblem(input);

  const problemId = await getDb().transaction(async (tx) => {
    await lockDraftEvent(tx, eventId);

    const [aggregate] = await tx
      .select({
        maxPosition: sql<number>`coalesce(max(${problems.position}), 0)`,
      })
      .from(problems)
      .where(eq(problems.eventId, eventId));

    const nextPosition = (aggregate?.maxPosition ?? 0) + 1;

    const [row] = await tx
      .insert(problems)
      .values({
        eventId,
        position: nextPosition,
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
        variables: sampleCase.variables,
      })),
    );

    // A brand-new Problem has no Figures yet, so any `/api/figures/<id>` in the
    // statement is a broken reference and refuses the save.
    await reconcileFiguresInTransaction(tx, row.id, problem.statementMd);

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
  await assertOrganizer(actor, "edit a problem");
  const { eventId } = await requireDraftProblem(actor, problemId);
  const problem = validatedProblem(input);

  const removedFigureKeys = await getDb().transaction(async (tx) => {
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
        variables: sampleCase.variables,
      })),
    );

    // The statement is the record of what is referenced: anything it no longer
    // mentions is deleted, object included, once the transaction commits.
    return reconcileFiguresInTransaction(tx, problemId, problem.statementMd);
  });

  await removeFigureObjects(removedFigureKeys);

  const updated = await getProblem(problemId);
  if (!updated) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }
  return updated;
}

export type MoveDirection = "up" | "down";

/** The two hidden/visible halves of one language's authoring pair. */
export type StarterPairInput = {
  starterCode: string;
  harnessCode: string;
};

function validateStarterPair(
  language: Language,
  input: StarterPairInput,
): StarterPairInput {
  const label = LANGUAGE_LABELS[language];
  if (typeof input?.starterCode !== "string" || !input.starterCode.trim()) {
    throw new DomainError(
      "starter_required",
      `${label} Starter Code is the whole file a participant opens; it cannot be empty.`,
    );
  }
  if (typeof input?.harnessCode !== "string" || !input.harnessCode.trim()) {
    throw new DomainError(
      "harness_required",
      `The ${label} Harness is appended at run time; it cannot be empty.`,
    );
  }
  // Store both as typed: indentation and blank lines are part of a source file.
  return { starterCode: input.starterCode, harnessCode: input.harnessCode };
}

/**
 * Saves the Starter Code and Harness for one language. A pair is unique per
 * Problem and language, so a second save updates the same row rather than
 * adding another.
 */
export async function saveProblemStarter(
  actor: ProblemActor,
  problemId: string,
  language: string,
  input: StarterPairInput,
): Promise<ProblemSummary> {
  await assertOrganizer(actor, "edit a problem");
  const { eventId } = await requireDraftProblem(actor, problemId);

  if (!isLanguage(language)) {
    throw new DomainError(
      "language_invalid",
      "A problem holds Starter Code for Python 3, Java, and C++ only.",
    );
  }
  const pair = validateStarterPair(language, input);

  await getDb().transaction(async (tx) => {
    await lockDraftEvent(tx, eventId);

    await tx
      .insert(problemStarters)
      .values({
        problemId,
        language,
        starterCode: pair.starterCode,
        harnessCode: pair.harnessCode,
      })
      .onConflictDoUpdate({
        target: [problemStarters.problemId, problemStarters.language],
        set: {
          starterCode: pair.starterCode,
          harnessCode: pair.harnessCode,
        },
      });
  });

  const updated = await getProblem(problemId);
  if (!updated) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }
  return updated;
}

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
  await assertOrganizer(actor, "reorder problems");
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
