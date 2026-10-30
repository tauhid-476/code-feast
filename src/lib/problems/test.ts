import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { events, problems } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { isApprovedOrganizer } from "@/lib/organizers/whitelist";
import type { ProblemActor } from "@/lib/problems/manage";
import {
  runAgainstSamples,
  type RunOptions,
  type RunResult,
} from "@/lib/runner/run";

/**
 * The organizer's "Test this problem" Run (SPEC §4.3). It is a normal Run with
 * an ownership check in front of it: the same pipeline, the same response.
 */
export type TestProblemInput = {
  eventId: string;
  problemId: string;
  language: string;
  /** The reference solution only; the Harness is appended by the runner. */
  code: string;
};

/**
 * Testing is read-only, so it is allowed in every event status. The pre-event
 * rehearsal is its purpose, but re-running a problem after the event is the
 * same action and needs no second implementation.
 */
export async function testProblem(
  actor: ProblemActor,
  input: TestProblemInput,
  options: RunOptions = {},
): Promise<RunResult> {
  if (!(await isApprovedOrganizer(actor.email))) {
    throw new DomainError(
      "not_organizer",
      "Only an organizer can test a problem.",
      403,
    );
  }

  // Join the event so "not mine" and "not this event" share one 404: a second
  // organizer learns nothing about another's problems.
  const [problem] = await getDb()
    .select({ id: problems.id })
    .from(problems)
    .innerJoin(events, eq(problems.eventId, events.id))
    .where(
      and(
        eq(problems.id, input.problemId),
        eq(problems.eventId, input.eventId),
        eq(events.createdBy, actor.id),
      ),
    )
    .limit(1);

  if (!problem) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }

  return runAgainstSamples(
    { problemId: problem.id, language: input.language, code: input.code },
    { ...options, eventId: input.eventId },
  );
}
