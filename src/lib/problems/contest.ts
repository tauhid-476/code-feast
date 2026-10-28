import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { problemStarters, problems, testCases } from "@/lib/db/schema";
import { isLanguage, LANGUAGES, type Language } from "@/lib/env";
import type { ParticipantContext } from "@/lib/participants/queries";
import type { SampleCase } from "./queries";

/**
 * The participant-facing projection of the Problem set. Ticket 09 must read
 * Problems through this function: visibility before Start, and the absence of
 * the Harness, are properties of the query rather than of a page.
 */

export type ContestStarter = {
  language: Language;
  starterCode: string;
};

export type ContestProblem = {
  id: string;
  position: number;
  title: string;
  difficulty: string | null;
  statementMd: string;
  sampleCases: SampleCase[];
  /** Starter Code only. Harness text is never selected here. */
  starters: ContestStarter[];
};

/** Stable language order for the contest selector. */
export const CONTEST_LANGUAGES = LANGUAGES;

/**
 * Problems in position order for a Participant who is entitled to see them.
 *
 * The context is the only input, so the caller cannot skip the participant
 * loader: `loadParticipantContext` has already reconciled the Deadline, and a
 * viewer without a Participant row or a draft event gets an empty list.
 */
export async function listContestProblems(
  context: ParticipantContext | null,
): Promise<ContestProblem[]> {
  if (!context?.participant) return [];
  if (context.event.status === "draft") return [];

  const rows = await getDb()
    .select({
      id: problems.id,
      position: problems.position,
      title: problems.title,
      difficulty: problems.difficulty,
      statementMd: problems.statementMd,
    })
    .from(problems)
    .where(eq(problems.eventId, context.event.id))
    .orderBy(asc(problems.position), asc(problems.createdAt));

  if (rows.length === 0) return [];

  const problemIds = rows.map((row) => row.id);

  const cases = await getDb()
    .select({
      problemId: testCases.problemId,
      position: testCases.position,
      input: testCases.input,
      expectedOutput: testCases.expectedOutput,
    })
    .from(testCases)
    .where(inArray(testCases.problemId, problemIds))
    .orderBy(asc(testCases.problemId), asc(testCases.position));

  const starters = await getDb()
    .select({
      problemId: problemStarters.problemId,
      language: problemStarters.language,
      starterCode: problemStarters.starterCode,
    })
    .from(problemStarters)
    .where(inArray(problemStarters.problemId, problemIds))
    .orderBy(
      asc(problemStarters.problemId),
      asc(problemStarters.language),
    );

  const casesByProblem = new Map<string, SampleCase[]>();
  for (const row of cases) {
    const list = casesByProblem.get(row.problemId) ?? [];
    list.push({
      position: row.position,
      input: row.input,
      expectedOutput: row.expectedOutput,
    });
    casesByProblem.set(row.problemId, list);
  }

  const startersByProblem = new Map<string, ContestStarter[]>();
  for (const row of starters) {
    if (!isLanguage(row.language)) continue;
    const list = startersByProblem.get(row.problemId) ?? [];
    list.push({ language: row.language, starterCode: row.starterCode });
    startersByProblem.set(row.problemId, list);
  }

  return rows.map((row) => ({
    ...row,
    sampleCases: casesByProblem.get(row.id) ?? [],
    starters: (startersByProblem.get(row.id) ?? []).sort(
      (a, b) =>
        CONTEST_LANGUAGES.indexOf(a.language) -
        CONTEST_LANGUAGES.indexOf(b.language),
    ),
  }));
}
