import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { problemStarters, problems, testCases } from "@/lib/db/schema";
import { listReadyFigureViews } from "@/lib/figures/queries";
import type { FigureView } from "@/lib/figures/types";
import { isLanguage, languageRank, type Language } from "@/lib/languages";

/** A Sample Test Case as the authoring surface sees it. Positions are 1 and 2. */
export type SampleCase = {
  position: number;
  input: string;
  expectedOutput: string;
};

/**
 * Organizer-facing Starter Code and Harness for one language. This carries the
 * hidden Harness, so it belongs on the authoring surface only. Participant
 * reads use the narrow projection in `participant.ts`.
 */
export type ProblemStarterPair = {
  language: Language;
  starterCode: string;
  harnessCode: string;
};

export type ProblemSummary = {
  id: string;
  position: number;
  title: string;
  difficulty: string | null;
  statementMd: string;
  sampleCases: SampleCase[];
  starters: ProblemStarterPair[];
  /** Ready Figure metadata for the authoring preview; never the bytes. */
  figures: FigureView[];
};

const problemColumns = {
  id: problems.id,
  position: problems.position,
  title: problems.title,
  difficulty: problems.difficulty,
  statementMd: problems.statementMd,
};

/** Sample Test Cases for a set of problems, keyed by problem id. */
export async function listSampleCases(
  problemIds: string[],
): Promise<Map<string, SampleCase[]>> {
  if (problemIds.length === 0) return new Map();

  const cases = await getDb()
    .select({
      problemId: testCases.problemId,
      position: testCases.position,
      input: testCases.input,
      expectedOutput: testCases.expectedOutput,
    })
    .from(testCases)
    .where(inArray(testCases.problemId, problemIds))
    .orderBy(asc(testCases.position));

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
  return byProblem;
}

/** Every Starter Code/Harness pair for a set of problems, keyed by problem id. */
async function listStarterPairs(
  problemIds: string[],
): Promise<Map<string, ProblemStarterPair[]>> {
  if (problemIds.length === 0) return new Map();

  const rows = await getDb()
    .select({
      problemId: problemStarters.problemId,
      language: problemStarters.language,
      starterCode: problemStarters.starterCode,
      harnessCode: problemStarters.harnessCode,
    })
    .from(problemStarters)
    .where(inArray(problemStarters.problemId, problemIds));

  const byProblem = new Map<string, ProblemStarterPair[]>();
  for (const row of rows) {
    // The schema's check constraint makes this unreachable, but a bad row must
    // never leak into a typed listing.
    if (!isLanguage(row.language)) continue;
    const list = byProblem.get(row.problemId) ?? [];
    list.push({
      language: row.language,
      starterCode: row.starterCode,
      harnessCode: row.harnessCode,
    });
    byProblem.set(row.problemId, list);
  }
  for (const list of byProblem.values()) {
    list.sort((a, b) => languageRank(a.language) - languageRank(b.language));
  }
  return byProblem;
}

/**
 * Problems of one event in position order, each with its Sample Test Cases and
 * its per-language Starter Code and Harness. This is the authoring shape;
 * participant-facing reads are a narrower projection.
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

  const problemIds = rows.map((row) => row.id);
  const [cases, starters, figures] = await Promise.all([
    listSampleCases(problemIds),
    listStarterPairs(problemIds),
    listReadyFigureViews(problemIds),
  ]);

  return rows.map((row) => ({
    ...row,
    sampleCases: cases.get(row.id) ?? [],
    starters: starters.get(row.id) ?? [],
    figures: figures.get(row.id) ?? [],
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

  const [cases, starters, figures] = await Promise.all([
    listSampleCases([problemId]),
    listStarterPairs([problemId]),
    listReadyFigureViews([problemId]),
  ]);

  return {
    ...row,
    sampleCases: cases.get(problemId) ?? [],
    starters: starters.get(problemId) ?? [],
    figures: figures.get(problemId) ?? [],
  };
}
