import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { problemStarters, problems } from "@/lib/db/schema";
import { isLanguage, languageRank, type Language } from "@/lib/languages";
import { listSampleCases, type SampleCase } from "./queries";

/**
 * Participant-facing Problem reads.
 *
 * The Harness must never reach a participant. That guarantee is structural
 * here: this module selects `starter_code` and nothing else from
 * `problem_starters`, and it never selects a whole row. There is no field on
 * the returned types that could carry Harness text, so no later filter can
 * forget to remove it.
 */

/** The only part of a Starter Code/Harness pair a participant sees. */
export type ParticipantStarter = {
  language: Language;
  starterCode: string;
};

export type ParticipantProblem = {
  id: string;
  position: number;
  title: string;
  difficulty: string | null;
  statementMd: string;
  sampleCases: SampleCase[];
  starters: ParticipantStarter[];
};

/**
 * Every Problem of an event as the contest view shows it: statement, sample
 * cases, and the Starter Code per language. No Harness, by construction.
 */
export async function listParticipantProblems(
  eventId: string,
): Promise<ParticipantProblem[]> {
  const rows = await getDb()
    .select({
      id: problems.id,
      position: problems.position,
      title: problems.title,
      difficulty: problems.difficulty,
      statementMd: problems.statementMd,
    })
    .from(problems)
    .where(eq(problems.eventId, eventId))
    .orderBy(asc(problems.position), asc(problems.createdAt));

  if (rows.length === 0) return [];

  const problemIds = rows.map((row) => row.id);
  const [cases, starters] = await Promise.all([
    listSampleCases(problemIds),
    getParticipantStarters(problemIds),
  ]);

  return rows.map((row) => ({
    ...row,
    sampleCases: cases.get(row.id) ?? [],
    starters: starters.get(row.id) ?? [],
  }));
}

async function getParticipantStarters(
  problemIds: string[],
): Promise<Map<string, ParticipantStarter[]>> {
  const selected = await getDb()
    .select({
      problemId: problemStarters.problemId,
      language: problemStarters.language,
      starterCode: problemStarters.starterCode,
    })
    .from(problemStarters)
    .where(inArray(problemStarters.problemId, problemIds));

  const byProblem = new Map<string, ParticipantStarter[]>();
  for (const row of selected) {
    if (!isLanguage(row.language)) continue;
    const list = byProblem.get(row.problemId) ?? [];
    list.push({ language: row.language, starterCode: row.starterCode });
    byProblem.set(row.problemId, list);
  }
  for (const list of byProblem.values()) {
    list.sort((a, b) => languageRank(a.language) - languageRank(b.language));
  }
  return byProblem;
}
