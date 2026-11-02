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
import { ContestWorkspace } from "@/components/contest-workspace";
import { ModeToggle } from "@/components/mode-toggle";
import { SubmitContest } from "@/components/submit-contest";
import { ThemeProvider } from "@/components/theme-provider";
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

    // Tablist container
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Contest Problems"');

    // Pill tabs
    expect(html).toContain('role="tab"');
    expect(html).toContain('id="problem-tab-prob-1"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("border-amber-500"); // current pill amber border

    // Attempted indicator (amber dot)
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

describe("ThemeProvider & ModeToggle", () => {
  it("renders ThemeProvider wrapping children", () => {
    const html = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        { defaultTheme: "dark" },
        createElement("div", { id: "test-child" }, "Theme content"),
      ),
    );

    expect(html).toContain("Theme content");
  });

  it("renders ModeToggle button with aria-label", () => {
    const html = renderToStaticMarkup(createElement(ModeToggle, {}));
    expect(html).toContain("Toggle theme");
  });
});
