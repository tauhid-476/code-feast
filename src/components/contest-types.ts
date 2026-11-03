import type { FigureView } from "@/lib/figures/types";
import type { Language } from "@/lib/languages";

/**
 * The serializable shape the contest page hands to the workspace. It is built
 * from `listContestProblems` and `listDrafts`, so it never carries Harness text.
 */

export type TestCaseVariable = {
  name: string;
  value: string;
};

export type ContestSampleCaseView = {
  position: number;
  input: string;
  expectedOutput: string;
  variables?: TestCaseVariable[] | null;
};

export type ContestStarterView = {
  language: Language;
  starterCode: string;
};

export type ContestProblemView = {
  id: string;
  position: number;
  title: string;
  difficulty: string | null;
  statementMd: string;
  sampleCases: ContestSampleCaseView[];
  starters: ContestStarterView[];
  figures: FigureView[];
};

export type ContestDraftView = {
  problemId: string;
  language: Language;
  code: string;
  /** ISO instant, already the server's `updated_at`. */
  updatedAt: string;
};
