import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { problems, testCases } from "@/lib/db/schema";

/** A Sample Test Case as the authoring surface sees it. Positions are 1 and 2. */
export type SampleCase = {
  position: number;
  input: string;
  expectedOutput: string;
};

export type ProblemSummary = {
  id: string;
  position: number;
  title: string;
  difficulty: string | null;
  statementMd: string;
  sampleCases: SampleCase[];
};

const problemColumns = {
  id: problems.id,
  position: problems.position,
  title: problems.title,
  difficulty: problems.difficulty,
  statementMd: problems.statementMd,
};

/**
 * Problems of one event in position order, each with its Sample Test Cases in
 * their own order. This is the authoring shape: ticket 04 adds starters, and
 * participant-facing reads will be a narrower projection.
 */
export async function listProblems(
  eventId: string,
): Promise<ProblemSummary[]> {
  const rows = await getDb()
    .select(problemColumns)
    .from(problems)
    .where(eq(problems.eventId, eventId))
    .orderBy(asc(problems.position), asc(problems.createdAt));

  if (rows.length === 0) return [];

  const cases = await getDb()
    .select({
      problemId: testCases.problemId,
      position: testCases.position,
      input: testCases.input,
      expectedOutput: testCases.expectedOutput,
    })
    .from(testCases)
    .where(
      inArray(
        testCases.problemId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(testCases.problemId), asc(testCases.position));

  const byProblem = new Map<string, SampleCase[]>();
  for (const row of cases) {
    const list = byProblem.get(row.problemId) ?? [];
    list.push({
      position: row.position,
      input: row.input,
      expectedOutput: row.expectedOutput,
    });
    byProblem.set(row.problemId, list);
  }

  return rows.map((row) => ({
    ...row,
    sampleCases: byProblem.get(row.id) ?? [],
  }));
}

/** One problem by id, or null. Used by the authoring surface after a write. */
export async function getProblem(
  problemId: string,
): Promise<ProblemSummary | null> {
  const [row] = await getDb()
    .select(problemColumns)
    .from(problems)
    .where(eq(problems.id, problemId))
    .limit(1);

  if (!row) return null;

  const cases = await getDb()
    .select({
      position: testCases.position,
      input: testCases.input,
      expectedOutput: testCases.expectedOutput,
    })
    .from(testCases)
    .where(eq(testCases.problemId, problemId))
    .orderBy(asc(testCases.position));

  return { ...row, sampleCases: cases };
}
