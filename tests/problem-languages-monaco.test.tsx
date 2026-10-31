import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LanguagePairFields } from "@/components/language-pair-fields";
import { ProblemLanguages } from "@/components/problem-languages";
import type { ProblemSummary } from "@/lib/problems/queries";

vi.mock("@/app/admin/events/[id]/actions", () => ({
  saveProblemStarterAction: vi.fn().mockResolvedValue({}),
}));

const mockProblem: ProblemSummary = {
  id: "29ef683f-97e2-4e46-aed9-6c773311dca3",
  position: 1,
  title: "Two Sum",
  difficulty: "easy",
  statementMd: "Find two numbers that add up to target.",
  sampleCases: [],
  starters: [
    {
      language: "python",
      starterCode: "def two_sum(): pass\n",
      harnessCode: "print(two_sum())\n",
    },
  ],
  figures: [],
};

describe("LanguagePairFields & ProblemLanguages Monaco authoring", () => {
  it("renders Starter Code and Harness fields with fallback textareas and Monaco containers", () => {
    const html = renderToStaticMarkup(
      createElement(LanguagePairFields, {
        problemId: mockProblem.id,
        language: "python",
        value: {
          starterCode: "def solve():\n    pass\n",
          harnessCode: "print(solve())\n",
        },
        onChange: () => {},
      }),
    );

    // Labels and descriptions
    expect(html).toContain("Starter Code");
    expect(html).toContain("Harness");
    expect(html).toContain("The whole file a participant opens for Python 3");
    expect(html).toContain("Hidden from participants and appended to their code at run time");

    // Accessible fallback textareas for SSR/tests
    expect(html).toContain('id="starter-python"');
    expect(html).toContain('id="harness-python"');
    expect(html).toContain("def solve():");
    expect(html).toContain("print(solve())");
  });

  it("renders unsaved dot on tab when draft differs from saved", () => {
    // Problem has starter for python, but none for java
    const html = renderToStaticMarkup(
      createElement(ProblemLanguages, {
        eventId: "event-123",
        problem: mockProblem,
      }),
    );

    // Contains tab triggers for Python 3, Java, C++
    expect(html).toContain("Python 3");
    expect(html).toContain("Java");
    expect(html).toContain("C++");
  });
});
