import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/e/[code]/actions", () => ({
  submitContestAction: vi.fn(),
}));

import { ContestProblemNav } from "@/components/contest-problem-nav";
import { ContestTestPanel } from "@/components/contest-test-panel";
import type { ContestProblemView } from "@/components/contest-types";
import { SubmitContest } from "@/components/submit-contest";
import type { RunResult } from "@/lib/runner/run";

const mockProblems: ContestProblemView[] = [
  {
    id: "prob-1",
    position: 1,
    title: "Two Sum",
    difficulty: "easy",
    statementMd: "Find two numbers.",
    sampleCases: [
      { position: 1, input: "2 7 11 15\n9\n", expectedOutput: "0 1\n" },
      { position: 2, input: "3 2 4\n6\n", expectedOutput: "1 2\n" },
    ],
    starters: [{ language: "python", starterCode: "def two_sum(): pass\n" }],
    figures: [],
  },
  {
    id: "prob-2",
    position: 2,
    title: "Reverse Linked List",
    difficulty: "medium",
    statementMd: "Reverse a linked list.",
    sampleCases: [
      { position: 1, input: "1 2 3 4 5\n", expectedOutput: "5 4 3 2 1\n" },
    ],
    starters: [{ language: "python", starterCode: "def reverse(): pass\n" }],
    figures: [],
  },
];

describe("ContestProblemNav", () => {
  it("renders problem selector and progress counter", () => {
    const html = renderToStaticMarkup(
      createElement(ContestProblemNav, {
        problems: mockProblems,
        selectedProblemId: "prob-1",
        onSelectProblem: () => {},
        statuses: {
          "prob-1": "solved",
          "prob-2": "unattempted",
        },
      }),
    );

    expect(html).toContain("Two Sum");
    expect(html).toContain("1/2 Solved");
    expect(html).toContain("Previous question");
    expect(html).toContain("Next question");
  });

  it("reflects 2/2 Solved when all problems are solved", () => {
    const html = renderToStaticMarkup(
      createElement(ContestProblemNav, {
        problems: mockProblems,
        selectedProblemId: "prob-2",
        onSelectProblem: () => {},
        statuses: {
          "prob-1": "solved",
          "prob-2": "solved",
        },
      }),
    );

    expect(html).toContain("2/2 Solved");
  });
});

describe("ContestTestPanel", () => {
  it("renders sample test case details in testcase tab", () => {
    const html = renderToStaticMarkup(
      createElement(ContestTestPanel, {
        problem: mockProblems[0],
        result: null,
        error: null,
        running: false,
        onRun: () => {},
        canRun: true,
        activeTab: "testcase",
        onTabChange: () => {},
        isCollapsed: false,
        onToggleCollapsed: () => {},
      }),
    );

    expect(html).toContain("Testcase");
    expect(html).toContain("Test Result");
    expect(html).toContain("Case 1");
    expect(html).toContain("2 7 11 15");
    expect(html).toContain("0 1");
  });

  it("renders Accepted verdict and runtime when all sample cases pass", () => {
    const mockResult: RunResult = {
      compileError: null,
      sandboxError: null,
      timedOut: false,
      cases: [
        {
          index: 0,
          input: "2 7 11 15\n9\n",
          expected: "0 1\n",
          actual: "0 1\n",
          stderr: "",
          exitCode: 0,
          ms: 15,
          pass: true,
        },
        {
          index: 1,
          input: "3 2 4\n6\n",
          expected: "1 2\n",
          actual: "1 2\n",
          stderr: "",
          exitCode: 0,
          ms: 12,
          pass: true,
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(ContestTestPanel, {
        problem: mockProblems[0],
        result: mockResult,
        error: null,
        running: false,
        onRun: () => {},
        canRun: true,
        activeTab: "result",
        onTabChange: () => {},
        isCollapsed: false,
        onToggleCollapsed: () => {},
      }),
    );

    expect(html).toContain("Accepted");
    expect(html).toContain("2 of 2 passed");
    expect(html).toContain("Runtime: 27 ms");
  });

  it("renders Wrong Answer and actual vs expected output when a case fails", () => {
    const mockResult: RunResult = {
      compileError: null,
      sandboxError: null,
      timedOut: false,
      cases: [
        {
          index: 0,
          input: "2 7 11 15\n9\n",
          expected: "0 1\n",
          actual: "9 9\n",
          stderr: "",
          exitCode: 0,
          ms: 10,
          pass: false,
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(ContestTestPanel, {
        problem: mockProblems[0],
        result: mockResult,
        error: null,
        running: false,
        onRun: () => {},
        canRun: true,
        activeTab: "result",
        onTabChange: () => {},
        isCollapsed: false,
        onToggleCollapsed: () => {},
      }),
    );

    expect(html).toContain("Wrong Answer");
    expect(html).toContain("0 of 1 passed");
    expect(html).toContain("9 9");
    expect(html).toContain("0 1");
  });
});

describe("SubmitContest with Problem Summary", () => {
  it("renders submit trigger button", () => {
    const html = renderToStaticMarkup(
      createElement(SubmitContest, {
        code: "TEST01",
        sessionId: "sess-1",
        flush: async () => true,
        onSessionRefused: () => {},
        summary: {
          total: 2,
          solved: 1,
          attempted: 0,
          unattempted: 1,
          problems: [
            { id: "prob-1", position: 1, title: "Two Sum", status: "solved" },
            { id: "prob-2", position: 2, title: "Reverse List", status: "unattempted" },
          ],
        },
      }),
    );

    expect(html).toContain("Submit");
  });
});
