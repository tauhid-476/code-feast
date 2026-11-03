import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/e/[code]/actions", () => ({
  submitContestAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

import { ContestProblemNav } from "@/components/contest-problem-nav";
import { ContestWorkspace } from "@/components/contest-workspace";
import { ContestTestPanel } from "@/components/contest-test-panel";
import { SubmitContest } from "@/components/submit-contest";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import type { ContestProblemView } from "@/components/contest-types";
import type { RunResult } from "@/lib/runner/run";

const mockProblems: ContestProblemView[] = [
  {
    id: "prob-1",
    position: 1,
    title: "Two Sum",
    difficulty: "Easy",
    statementMd: "Given an array of integers `nums` and an integer `target`...",
    sampleCases: [
      {
        position: 1,
        input: "2 7 11 15\n9\n",
        expectedOutput: "0 1\n",
      },
    ],
    starters: [
      {
        language: "python",
        starterCode: "def solve():\n    pass\n",
      },
    ],
    figures: [],
  },
  {
    id: "prob-2",
    position: 2,
    title: "Reverse Linked List",
    difficulty: "Medium",
    statementMd: "Reverse a singly linked list...",
    sampleCases: [
      {
        position: 1,
        input: "1 2 3 4 5\n",
        expectedOutput: "5 4 3 2 1\n",
      },
    ],
    starters: [
      {
        language: "python",
        starterCode: "def reverse():\n    pass\n",
      },
    ],
    figures: [],
  },
];

describe("ContestProblemNav", () => {
  it("renders segmented strip of numbered pills with roving tabindex and states", () => {
    const html = renderToStaticMarkup(
      createElement(ContestProblemNav, {
        problems: mockProblems,
        selectedProblemId: "prob-1",
        onSelectProblem: () => {},
        statuses: {
          "prob-1": "attempted",
          "prob-2": "unattempted",
        },
      }),
    );

    // Nav container with tablist role
    expect(html).toContain('role="tablist"');

    // First pill is selected with tabindex 0 and amber dot for attempted
    expect(html).toContain('id="problem-tab-prob-1"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("bg-amber-500");

    // Second pill is idle with tabindex -1
    expect(html).toContain('id="problem-tab-prob-2"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('tabindex="-1"');

    // Tooltip labels
    expect(html).toContain("01 · Two Sum · Attempted");
    expect(html).toContain("02 · Reverse Linked List · Unattempted");
  });

  it("renders green check icon on passed problem pill", () => {
    const html = renderToStaticMarkup(
      createElement(ContestProblemNav, {
        problems: mockProblems,
        selectedProblemId: "prob-2",
        onSelectProblem: () => {},
        statuses: {
          "prob-1": "solved",
          "prob-2": "unattempted",
        },
      }),
    );

    // Check icon on passed problem
    expect(html).toContain("lucide-check");
    expect(html).toContain("text-emerald-500");
    expect(html).toContain("01 · Two Sum · Passed");
  });
});

describe("ContestWorkspace Header and Secondary Navigation", () => {
  it("renders compact progress label, timer, and secondary navigation buttons", () => {
    const html = renderToStaticMarkup(
      createElement(ContestWorkspace, {
        code: "TESTCODE",
        eventTitle: "Weekly Contest #1",
        participantId: "part-1",
        participantName: "Alice",
        problems: mockProblems,
        drafts: [],
        sessionId: "sess-1",
        strikes: 0,
        serverNow: "2026-11-01T12:00:00.000Z",
        deadlineAt: "2026-11-01T13:00:00.000Z",
        onSessionRefused: () => {},
      }),
    );

    // Header progress label
    expect(html).toContain("0/2 solved");

    // Timer
    expect(html).toContain('role="timer"');

    // Secondary navigation at the bottom of the statement panel
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("Problem 1 of 2");

    // Left statement panel should no longer contain sample test cases
    expect(html).not.toContain("Sample test cases");
  });

  it("renders ChaiUI language dropdown menu and split panel collapse triggers", () => {
    const html = renderToStaticMarkup(
      createElement(ContestWorkspace, {
        code: "TESTCODE",
        eventTitle: "Weekly Contest #1",
        participantId: "part-1",
        participantName: "Alice",
        problems: mockProblems,
        drafts: [],
        sessionId: "sess-1",
        strikes: 0,
        serverNow: "2026-11-01T12:00:00.000Z",
        deadlineAt: "2026-11-01T13:00:00.000Z",
        onSessionRefused: () => {},
      }),
    );

    // Language dropdown menu trigger
    expect(html).toContain('aria-label="Language"');
    expect(html).toContain("Python 3");

    // Split panel collapse buttons
    expect(html).toContain('aria-label="Collapse problem statement panel"');
    expect(html).toContain('aria-label="Collapse code editor panel"');

    // Resizer handle divider
    expect(html).toContain("cursor-col-resize");
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
    expect(html).toContain("Passed test cases: 2 / 2");
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
    expect(html).toContain("Passed test cases: 0 / 1");
    expect(html).toContain("9 9");
    expect(html).toContain("0 1");
  });

  it("renders variables with variable names in testcase tab and result tab", () => {
    const problemWithVars: ContestProblemView = {
      ...mockProblems[0],
      sampleCases: [
        {
          position: 1,
          input: "5\n[[0,1],[1,2],[3,4]]",
          expectedOutput: "2",
          variables: [
            { name: "n", value: "5" },
            { name: "edges", value: "[[0,1],[1,2],[3,4]]" },
          ],
        },
      ],
    };

    const testcaseHtml = renderToStaticMarkup(
      createElement(ContestTestPanel, {
        problem: problemWithVars,
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

    expect(testcaseHtml).toContain("n =");
    expect(testcaseHtml).toContain("5");
    expect(testcaseHtml).toContain("edges =");
    expect(testcaseHtml).toContain("[[0,1],[1,2],[3,4]]");
    expect(testcaseHtml).toContain("Expected =");
    expect(testcaseHtml).toContain("2");

    const resultWithVars: RunResult = {
      compileError: null,
      sandboxError: null,
      timedOut: false,
      cases: [
        {
          index: 0,
          input: "5\n[[0,1],[1,2],[3,4]]",
          expected: "2",
          actual: "2",
          stderr: "",
          exitCode: 0,
          ms: 18,
          pass: true,
          variables: [
            { name: "n", value: "5" },
            { name: "edges", value: "[[0,1],[1,2],[3,4]]" },
          ],
        },
      ],
    };

    const resultHtml = renderToStaticMarkup(
      createElement(ContestTestPanel, {
        problem: problemWithVars,
        result: resultWithVars,
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

    expect(resultHtml).toContain("n = 5");
    expect(resultHtml).toContain("edges = [[0,1],[1,2],[3,4]]");
    expect(resultHtml).toContain("Your Output:");
    expect(resultHtml).toContain("Expected output:");
    expect(resultHtml).toContain("Passed test cases: 1 / 1");
  });

  it("formats data structures like array brackets and string quotes for participants", () => {
    const problemWithDataStructures: ContestProblemView = {
      ...mockProblems[0],
      sampleCases: [
        {
          position: 1,
          input: "2 7 11 15\n9",
          expectedOutput: "0 1",
          variables: [
            { name: "nums", value: "2 7 11 15" },
            { name: "target", value: "9" },
          ],
        },
        {
          position: 2,
          input: "()",
          expectedOutput: "true",
          variables: [{ name: "s", value: "()" }],
        },
      ],
    };

    const testcaseHtml = renderToStaticMarkup(
      createElement(ContestTestPanel, {
        problem: problemWithDataStructures,
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

    expect(testcaseHtml).toContain("nums =");
    expect(testcaseHtml).toContain("[2, 7, 11, 15]");
    expect(testcaseHtml).toContain("target =");
    expect(testcaseHtml).toContain("9");

    const result: RunResult = {
      compileError: null,
      sandboxError: null,
      timedOut: false,
      cases: [
        {
          index: 0,
          input: "2 7 11 15\n9",
          expected: "0 1",
          actual: "0 1",
          stderr: "",
          exitCode: 0,
          ms: 10,
          pass: true,
          variables: [
            { name: "nums", value: "2 7 11 15" },
            { name: "target", value: "9" },
          ],
        },
        {
          index: 1,
          input: "()",
          expected: "true",
          actual: "true",
          stderr: "",
          exitCode: 0,
          ms: 10,
          pass: true,
          variables: [{ name: "s", value: "()" }],
        },
      ],
    };

    const resultHtml = renderToStaticMarkup(
      createElement(ContestTestPanel, {
        problem: problemWithDataStructures,
        result,
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

    expect(resultHtml).toContain("nums = [2, 7, 11, 15]");
    expect(resultHtml).toContain("target = 9");
    expect(resultHtml).toContain("Passed test cases: 2 / 2");
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

describe("ThemeProvider & ModeToggle", () => {
  it("renders ThemeProvider wrapping children", () => {
    const html = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        { defaultTheme: "dark" },
        createElement("div", { id: "test-child" }, "Theme content"),
      ),
    );

    expect(html).toContain('id="test-child"');
    expect(html).toContain("Theme content");
  });

  it("renders ModeToggle button with aria-label", () => {
    const html = renderToStaticMarkup(createElement(ModeToggle));

    expect(html).toContain("Toggle theme");
  });
});
