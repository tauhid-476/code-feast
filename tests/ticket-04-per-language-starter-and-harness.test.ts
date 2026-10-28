import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LANGUAGES } from "@/lib/languages";
import { createProblem, saveProblemStarter, type ProblemActor } from "@/lib/problems/manage";
import { getProblem } from "@/lib/problems/queries";
import { listParticipantProblems } from "@/lib/problems/participant";
import { assembleRunProgram } from "@/lib/problems/program";
import { languageCoverage } from "@/lib/problems/coverage";
import { ProblemCompleteness } from "@/components/problem-completeness";
import { LanguagePairFields } from "@/components/language-pair-fields";
import { insertEvent, insertStarter, testUser, type TestUser } from "./helpers/factories";
import { db, useCleanDatabase } from "./helpers/db";
import { eq } from "drizzle-orm";
import { events } from "@/lib/db/schema";
import { drafts, submissionSnippets } from "@/lib/db/schema";

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

const organizer = testUser({ email: "organizer@example.com" });
const participant = testUser({ email: "solver@example.com" });

function actor(user: TestUser): ProblemActor {
  return { id: user.id, email: user.email };
}

const twoCases = [
  { input: "2 7 11 15\n9\n", expectedOutput: "0 1\n" },
  { input: "3 2 4\n6\n", expectedOutput: "1 2\n" },
];

const PYTHON_STARTER = `import sys


def two_sum(nums, target):
    """Return the indices of the two numbers that add up to target."""
    pass


if __name__ == "__main__":
    nums, target = sys.stdin.read().split("\\n")
    two_sum(nums, target)
`;

const PYTHON_HARNESS = `nums = list(map(int, input().split()))
target = int(input())
print(*two_sum(nums, target))
`;

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

async function draftProblem() {
  const event = await insertEvent({ createdBy: organizer.id });
  const problem = await createProblem(actor(organizer), event.id, {
    title: "Two Sum",
    statementMd: "Find the pair.",
    sampleCases: twoCases,
  });
  return { event, problem };
}

describe("per-language starter code and harness", () => {
  it("saves a Starter Code and Harness pair for Python 3, Java, and C++", async () => {
    const { problem } = await draftProblem();

    await saveProblemStarter(actor(organizer), problem.id, "python", {
      starterCode: PYTHON_STARTER,
      harnessCode: PYTHON_HARNESS,
    });
    await saveProblemStarter(actor(organizer), problem.id, "java", {
      starterCode: "public class Main {\n    static int[] twoSum(int[] nums, int target) {\n        return null;\n    }\n}\n",
      harnessCode: "// java harness\n",
    });
    await saveProblemStarter(actor(organizer), problem.id, "cpp", {
      starterCode: "#include <vector>\nstd::vector<int> twoSum(std::vector<int> nums, int target) {}\n",
      harnessCode: "// cpp harness\n",
    });

    const reloaded = await getProblem(problem.id);

    expect(reloaded?.starters.map((pair) => pair.language)).toEqual([
      "python",
      "java",
      "cpp",
    ]);
    // The whole file is stored as typed: imports, blank lines, indentation.
    expect(reloaded?.starters[0].starterCode).toBe(PYTHON_STARTER);
    expect(reloaded?.starters[0].harnessCode).toBe(PYTHON_HARNESS);
  });

  it("holds exactly one pair per Problem per language", async () => {
    const { problem } = await draftProblem();

    await saveProblemStarter(actor(organizer), problem.id, "python", {
      starterCode: "def two_sum():\n    pass\n",
      harnessCode: "print(two_sum())\n",
    });
    await saveProblemStarter(actor(organizer), problem.id, "python", {
      starterCode: "def two_sum(nums, target):\n    return []\n",
      harnessCode: "print(two_sum([2, 7], 9))\n",
    });

    const reloaded = await getProblem(problem.id);
    expect(reloaded?.starters).toHaveLength(1);
    expect(reloaded?.starters[0].starterCode).toContain("return []");
    expect(reloaded?.starters[0].harnessCode).toContain("[2, 7], 9");

    // The uniqueness rule is the database's, not only the upsert's.
    await expect(
      insertStarter(problem.id, "python", "duplicate", "duplicate"),
    ).rejects.toMatchObject({
      cause: { constraint: "problem_starters_problem_language_unique" },
    });
  });

  it("refuses an empty Starter Code or Harness with a message naming the language", async () => {
    const { problem } = await draftProblem();

    await expect(
      saveProblemStarter(actor(organizer), problem.id, "python", {
        starterCode: "   \n",
        harnessCode: "print(two_sum())\n",
      }),
    ).rejects.toMatchObject({
      code: "starter_required",
      message: expect.stringContaining("Python 3"),
    });

    await expect(
      saveProblemStarter(actor(organizer), problem.id, "cpp", {
        starterCode: "int main() { return 0; }\n",
        harnessCode: "",
      }),
    ).rejects.toMatchObject({
      code: "harness_required",
      message: expect.stringContaining("C++"),
    });

    await expect(getProblem(problem.id)).resolves.toMatchObject({ starters: [] });
  });

  it("refuses a language outside Python 3, Java, and C++", async () => {
    const { problem } = await draftProblem();

    await expect(
      saveProblemStarter(actor(organizer), problem.id, "rust", {
        starterCode: "fn main() {}",
        harnessCode: "fn harness() {}",
      }),
    ).rejects.toMatchObject({ code: "language_invalid" });

    await expect(getProblem(problem.id)).resolves.toMatchObject({ starters: [] });
  });

  it("only lets the owning organizer edit starters while the event is a draft", async () => {
    const { problem } = await draftProblem();
    const otherOrganizer = testUser({ email: "other-organizer@example.com" });
    process.env.ADMIN_EMAILS = `${organizer.email},${otherOrganizer.email}`;

    await expect(
      saveProblemStarter(actor(participant), problem.id, "python", {
        starterCode: "def two_sum(): pass",
        harnessCode: "two_sum()",
      }),
    ).rejects.toMatchObject({ code: "not_organizer" });

    await expect(
      saveProblemStarter(actor(otherOrganizer), problem.id, "python", {
        starterCode: "def two_sum(): pass",
        harnessCode: "two_sum()",
      }),
    ).rejects.toMatchObject({ code: "problem_not_found" });

    const live = await insertEvent({
      createdBy: organizer.id,
      status: "draft",
      code: "LIVE01",
    });
    const liveProblem = await createProblem(actor(organizer), live.id, {
      title: "Live problem",
      statementMd: "Statement.",
      sampleCases: twoCases,
    });
    // The event moves on after the problem was authored.
    await db
      .update(events)
      .set({ status: "live" })
      .where(eq(events.id, live.id));

    await expect(
      saveProblemStarter(actor(organizer), liveProblem.id, "python", {
        starterCode: "def two_sum(): pass",
        harnessCode: "two_sum()",
      }),
    ).rejects.toMatchObject({ code: "event_not_draft" });

    await expect(getProblem(problem.id)).resolves.toMatchObject({ starters: [] });
  });

  it("shows participants the Starter Code per language and never the Harness", async () => {
    const { event, problem } = await draftProblem();
    const secret = "HARNESS-ONLY-SENTINEL";

    await saveProblemStarter(actor(organizer), problem.id, "python", {
      starterCode: PYTHON_STARTER,
      harnessCode: `print(two_sum())\n# ${secret}\n`,
    });
    await saveProblemStarter(actor(organizer), problem.id, "java", {
      starterCode: "public class Main {}\n",
      harnessCode: `// ${secret}\n`,
    });
    await saveProblemStarter(actor(organizer), problem.id, "cpp", {
      starterCode: "int main() { return 0; }\n",
      harnessCode: `// ${secret}\n`,
    });

    const shown = await listParticipantProblems(event.id);

    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe("Two Sum");
    expect(shown[0].position).toBe(1);
    expect(shown[0].statementMd).toBe("Find the pair.");
    expect(shown[0].sampleCases).toEqual([
      { position: 1, input: twoCases[0].input, expectedOutput: twoCases[0].expectedOutput },
      { position: 2, input: twoCases[1].input, expectedOutput: twoCases[1].expectedOutput },
    ]);
    expect(shown[0].starters.map((starter) => starter.language)).toEqual([
      "python",
      "java",
      "cpp",
    ]);
    expect(shown[0].starters[0].starterCode).toBe(PYTHON_STARTER);

    // The projection has no harness field at all, not a filtered-out one.
    for (const starter of shown[0].starters) {
      expect(Object.keys(starter).sort()).toEqual(["language", "starterCode"]);
    }
    expect(JSON.stringify(shown)).not.toContain(secret);
  });

  it("assembles the code the runner receives by appending the Harness server-side", async () => {
    const { problem } = await draftProblem();
    await saveProblemStarter(actor(organizer), problem.id, "python", {
      starterCode: PYTHON_STARTER,
      harnessCode: PYTHON_HARNESS,
    });

    const code = "def two_sum(nums, target):\n    return [0, 1]";
    const program = await assembleRunProgram(problem.id, "python", code);

    expect(program.language).toBe("python");
    expect(program.source).toBe(`${code}\n${PYTHON_HARNESS}`);
    expect(program.sampleCases).toEqual([
      { position: 1, input: twoCases[0].input, expectedOutput: twoCases[0].expectedOutput },
      { position: 2, input: twoCases[1].input, expectedOutput: twoCases[1].expectedOutput },
    ]);
    // The assembled source is for execution, not a participant-facing payload.
    expect(program).not.toHaveProperty("starterCode");
    expect(program).not.toHaveProperty("harnessCode");

    const withNewline = await assembleRunProgram(
      problem.id,
      "python",
      `${code}\n`,
    );
    expect(withNewline.source).toBe(`${code}\n${PYTHON_HARNESS}`);
  });

  it("refuses to assemble a run for a language with no Harness", async () => {
    const { problem } = await draftProblem();
    await saveProblemStarter(actor(organizer), problem.id, "python", {
      starterCode: PYTHON_STARTER,
      harnessCode: PYTHON_HARNESS,
    });

    await expect(
      assembleRunProgram(problem.id, "java", "public class Main {}"),
    ).rejects.toMatchObject({
      code: "harness_missing",
      message: expect.stringContaining("Java"),
    });

    await expect(
      assembleRunProgram(problem.id, "rust", "fn main() {}"),
    ).rejects.toMatchObject({ code: "language_invalid" });
  });

  it("marks a Problem with a missing Starter Code as incomplete to the Organizer", () => {
    const onlyPython = [
      { language: "python" as const, starterCode: PYTHON_STARTER, harnessCode: PYTHON_HARNESS },
    ];
    const coverage = languageCoverage(onlyPython);

    expect(coverage.complete).toBe(false);
    expect(coverage.missingStarter).toEqual(["java", "cpp"]);
    expect(coverage.missingHarness).toEqual(["java", "cpp"]);
    expect(coverage.summary).toBe(
      "Missing starter code for Java, C++. Missing harness for Java, C++.",
    );

    const html = renderToStaticMarkup(
      createElement(ProblemCompleteness, { starters: onlyPython }),
    );
    expect(html).toContain("Missing starter code for Java, C++.");
    expect(html).toContain("text-destructive");

    const complete = LANGUAGES.map((language) => ({
      language,
      starterCode: "// complete\n",
      harnessCode: "// harness\n",
    }));
    expect(languageCoverage(complete).complete).toBe(true);
    expect(
      renderToStaticMarkup(
        createElement(ProblemCompleteness, { starters: complete }),
      ),
    ).toContain("All three languages ready");
  });

  it("treats a blank Starter Code as missing", () => {
    const coverage = languageCoverage([
      { language: "python", starterCode: "   \n", harnessCode: PYTHON_HARNESS },
      { language: "java", starterCode: "public class Main {}\n", harnessCode: "// h\n" },
      { language: "cpp", starterCode: "int main() {}\n", harnessCode: "// h\n" },
    ]);

    expect(coverage.complete).toBe(false);
    expect(coverage.missingStarter).toEqual(["python"]);
    expect(coverage.missingHarness).toEqual([]);
  });

  it("has nowhere to write Harness text into a Draft or a Submission", () => {
    // The Harness exists only on `problem_starters`. Drafts and submission
    // snippets store the participant's own code; the schema offers no harness
    // column they could be assembled into.
    expect(Object.keys(drafts)).not.toContain("harnessCode");
    expect(Object.keys(submissionSnippets)).not.toContain("harnessCode");
    expect(Object.keys(submissionSnippets)).toEqual(
      expect.arrayContaining(["problemId", "language", "code"]),
    );
  });

  it("gives the Organizer an editable Harness field with no read-only affordance", () => {
    const html = renderToStaticMarkup(
      createElement(LanguagePairFields, {
        language: "java",
        value: {
          starterCode: "public class Main {\n    // TODO\n}\n",
          harnessCode: "// hidden harness\nSystem.out.println(twoSum());\n",
        },
        onChange: () => {},
      }),
    );

    expect(html).toContain("public class Main");
    expect(html).toContain("// hidden harness");

    for (const id of ["starter-java", "harness-java"]) {
      const tag = html.match(new RegExp(`<textarea[^>]*id="${id}"[^>]*>`))?.[0];
      expect(tag).toBeDefined();
      expect(tag).not.toMatch(/readonly/i);
      expect(tag).not.toMatch(/\sdisabled(?:\s|=|>)/i);
    }
  });
});
