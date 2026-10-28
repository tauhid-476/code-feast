import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { problemStarters, testCases } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { LANGUAGE_LABELS, isLanguage, type Language } from "@/lib/languages";
import type { SampleCase } from "./queries";

/**
 * Harness assembly for the runner.
 *
 * This is the one place the hidden Harness is read. It exists to hand a single
 * source file to a sandbox: the code under test followed by the Harness. The
 * returned source is execution input only — it must never be persisted into a
 * draft or a submission, and must never be returned to a browser.
 */
export type RunProgram = {
  language: Language;
  /** The exact file to compile and run: submitted code, then the Harness. */
  source: string;
  sampleCases: SampleCase[];
};

/**
 * The file a sandbox receives: `code` and the hidden Harness, separated by one
 * newline. The Harness is appended here, server-side, so it never travels to a
 * participant's editor.
 */
export async function assembleRunProgram(
  problemId: string,
  language: string,
  code: string,
): Promise<RunProgram> {
  if (!isLanguage(language)) {
    throw new DomainError(
      "language_invalid",
      "A problem runs in Python 3, Java, or C++ only.",
    );
  }

  const [pair] = await getDb()
    .select({ harnessCode: problemStarters.harnessCode })
    .from(problemStarters)
    .where(
      and(
        eq(problemStarters.problemId, problemId),
        eq(problemStarters.language, language),
      ),
    )
    .limit(1);

  if (!pair) {
    throw new DomainError(
      "harness_missing",
      `This problem has no Harness for ${LANGUAGE_LABELS[language]} yet.`,
      409,
    );
  }

  const sampleCases = await getDb()
    .select({
      position: testCases.position,
      input: testCases.input,
      expectedOutput: testCases.expectedOutput,
    })
    .from(testCases)
    .where(eq(testCases.problemId, problemId))
    .orderBy(asc(testCases.position));

  return {
    language,
    source: appendHarness(code, pair.harnessCode),
    sampleCases,
  };
}

function appendHarness(code: string, harnessCode: string): string {
  if (!code) return harnessCode;
  return code.endsWith("\n") ? `${code}${harnessCode}` : `${code}\n${harnessCode}`;
}
