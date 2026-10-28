import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { runAgainstSamples, type RunResult } from "@/lib/runner/run";
import { replenishPool } from "@/lib/runner/pool";
import {
  SandboxTimeoutError,
  type SandboxRunResult,
} from "@/lib/runner/sandbox";
import { testProblem } from "@/lib/problems/test";
import { RunResultView } from "@/components/run-result";
import { TestProblemPanel } from "@/components/test-problem-panel";
import {
  insertEvent,
  insertProblem,
  insertStarter,
  insertTestCase,
  testUser,
} from "./helpers/factories";
import {
  FakeSandboxProvider,
  type FakeRunCall,
} from "./helpers/fake-sandbox-provider";
import { useCleanDatabase } from "./helpers/db";

useCleanDatabase();

const twoCases = [
  { input: "2 7 11 15\n9\n", expectedOutput: "0 1\n" },
  { input: "3 2 4\n6\n", expectedOutput: "1 2\n" },
];

const PYTHON_SOLUTION = `import sys


def two_sum(nums, target):
    seen = {}
    for index, value in enumerate(nums):
        if target - value in seen:
            return [seen[target - value], index]
        seen[value] = index
    return []
`;

const PYTHON_HARNESS = `nums = list(map(int, input().split()))
target = int(input())
print(*two_sum(nums, target))
`;

async function seedPythonProblem() {
  const event = await insertEvent();
  const problem = await insertProblem(event.id, { title: "Two Sum" });
  await insertStarter(problem.id, "python", "def two_sum(nums, target):\n    pass\n", PYTHON_HARNESS);
  for (const [index, sample] of twoCases.entries()) {
    await insertTestCase(
      problem.id,
      (index + 1) as 1 | 2,
      sample.input,
      sample.expectedOutput,
    );
  }
  return problem;
}

/** A fake Python interpreter: reads the sample input, writes the answer. */
function pythonRunner(answers: Record<string, string>) {
  return (call: FakeRunCall): SandboxRunResult | null => {
    if (!call.command.includes("python3")) return null;
    const input = call.options.stdin ?? "";
    return {
      stdout: answers[input] ?? "",
      stderr: "",
      exitCode: 0,
      ms: 12,
    };
  };
}

describe("Run pipeline", () => {
  it("returns the SPEC §7 shape, with one passing case per sample", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonRunner({
      "2 7 11 15\n9\n": "0 1\n",
      "3 2 4\n6\n": "1 2\n",
    });

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result).toEqual({
      compileError: null,
      timedOut: false,
      sandboxError: null,
      cases: [
        {
          index: 0,
          input: "2 7 11 15\n9\n",
          expected: "0 1\n",
          actual: "0 1\n",
          stderr: "",
          exitCode: 0,
          ms: 12,
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
    });
  });

  it("compares after trimming trailing whitespace on both sides only", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonRunner({
      // Trailing spaces and a blank line are ignored...
      "2 7 11 15\n9\n": "0 1   \n\n",
      // ...but a leading space changes the output.
      "3 2 4\n6\n": " 1 2\n",
    });

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result.cases.map((caseResult) => caseResult.pass)).toEqual([
      true,
      false,
    ]);
    expect(result.cases[1].actual).toBe(" 1 2\n");
  });

  it("runs the second sample even when the first one fails", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonRunner({
      "2 7 11 15\n9\n": "9 9\n",
      "3 2 4\n6\n": "1 2\n",
    });

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result.cases).toHaveLength(2);
    expect(result.cases[0]).toMatchObject({ index: 0, pass: false });
    expect(result.cases[1]).toMatchObject({ index: 1, pass: true });
    expect(result.compileError).toBeNull();
    expect(result.timedOut).toBe(false);
    expect(result.sandboxError).toBeNull();
    expect(
      provider.runs.filter((call) => call.command.includes("python3")),
    ).toHaveLength(2);
  });

  it("reports one compile error and runs no cases when compilation fails", async () => {
    const event = await insertEvent();
    const problem = await insertProblem(event.id, { title: "Two Sum" });
    await insertStarter(
      problem.id,
      "cpp",
      "#include <iostream>\nint main() { return 0; }\n",
      "// harness\n",
    );
    for (const [index, sample] of twoCases.entries()) {
      await insertTestCase(
        problem.id,
        (index + 1) as 1 | 2,
        sample.input,
        sample.expectedOutput,
      );
    }

    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = (call) => {
      if (!call.command.includes("g++")) return null;
      return {
        stdout: "",
        stderr: "main.cpp:3:1: error: expected ';' before '}' token\n",
        exitCode: 1,
        ms: 240,
      };
    };

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "cpp", code: "int main() {}" },
      { provider },
    );

    expect(result).toEqual({
      compileError: "main.cpp:3:1: error: expected ';' before '}' token\n",
      timedOut: false,
      sandboxError: null,
      // Nothing ran, so there are no cases to report — not even failed ones.
      cases: [],
    });

    const compiles = provider.runs.filter((call) => call.command.includes("g++"));
    expect(compiles).toHaveLength(1);
    expect(provider.runs).toHaveLength(2); // mkdir, then the compile
  });

  it("uses the per-language commands, timeouts, and memory limits", async () => {
    const event = await insertEvent();
    const problem = await insertProblem(event.id, { title: "Two Sum" });
    await insertStarter(problem.id, "python", "pass\n", "pass\n");
    await insertStarter(problem.id, "cpp", "int main() {}\n", "// harness\n");
    await insertStarter(
      problem.id,
      "java",
      "public class Main {}\n",
      "// harness\n",
    );
    for (const [index, sample] of twoCases.entries()) {
      await insertTestCase(
        problem.id,
        (index + 1) as 1 | 2,
        sample.input,
        sample.expectedOutput,
      );
    }

    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });

    for (const language of ["python", "cpp", "java"]) {
      await runAgainstSamples(
        { problemId: problem.id, language, code: "// reference\n" },
        { provider },
      );
    }

    const calls = provider.runs;
    const compileCalls = calls.filter(
      (call) => call.command.includes("g++") || call.command.includes("javac"),
    );
    // Compile is allowed 15s.
    expect(compileCalls.map((call) => call.options.timeoutMs)).toEqual([
      15_000, 15_000,
    ]);

    const gpp = compileCalls.find((call) => call.command.includes("g++"));
    expect(gpp?.command).toContain("g++ -O2 -std=c++17");
    const javac = compileCalls.find((call) => call.command.includes("javac"));
    expect(javac?.command).toContain("javac ");

    // Python and C++: 3s per case, 256MB of address space.
    const pythonRuns = calls.filter((call) => call.command.includes("python3"));
    expect(pythonRuns).toHaveLength(2);
    // Each sample's input is delivered on stdin, in position order.
    expect(pythonRuns.map((call) => call.options.stdin)).toEqual([
      "2 7 11 15\n9\n",
      "3 2 4\n6\n",
    ]);
    for (const call of pythonRuns) {
      expect(call.options.timeoutMs).toBe(3_000);
      expect(call.command).toContain("ulimit -v 262144");
      expect(call.command).toContain("python3 ");
    }

    const cppRuns = calls.filter((call) => /\/main'$/.test(call.command));
    expect(cppRuns).toHaveLength(2);
    for (const call of cppRuns) {
      expect(call.options.timeoutMs).toBe(3_000);
      expect(call.command).toContain("ulimit -v 262144");
    }

    // Java: 6s per case, a 512MB heap.
    const javaRuns = calls.filter((call) => call.command.startsWith("java "));
    expect(javaRuns).toHaveLength(2);
    for (const call of javaRuns) {
      expect(call.options.timeoutMs).toBe(6_000);
      expect(call.command).toContain("-Xmx512m");
      expect(call.command).toContain(" Main");
    }
  });

  it("reports a timeout as a failed case and still runs the other sample", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = (call) => {
      if (!call.command.includes("python3")) return null;
      if (call.options.stdin === "2 7 11 15\n9\n") {
        throw new SandboxTimeoutError("timed out", "partial\n", "");
      }
      return { stdout: "1 2\n", stderr: "", exitCode: 0, ms: 8 };
    };

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result).toEqual({
      compileError: null,
      timedOut: true,
      sandboxError: null,
      cases: [
        {
          index: 0,
          input: "2 7 11 15\n9\n",
          expected: "0 1\n",
          actual: "partial\n",
          stderr: "",
          exitCode: null,
          ms: 3_000,
          pass: false,
        },
        {
          index: 1,
          input: "3 2 4\n6\n",
          expected: "1 2\n",
          actual: "1 2\n",
          stderr: "",
          exitCode: 0,
          ms: 8,
          pass: true,
        },
      ],
    });
  });

  it("reports a dead sandbox as a sandbox error instead of throwing", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = (call) => {
      if (!call.command.includes("python3")) return null;
      throw new Error("sandbox is not running");
    };

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result.sandboxError).toBe("sandbox is not running");
    expect(result.cases).toEqual([]);
    expect(result.timedOut).toBe(false);
    expect(result.compileError).toBeNull();
  });

  it("truncates stdout at 64KB before it enters the response", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = (call) =>
      call.command.includes("python3")
        ? { stdout: "a".repeat(70_000), stderr: "", exitCode: 0, ms: 5 }
        : null;

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result.cases[0].actual).toHaveLength(64 * 1024);
    expect(result.cases[0].actual).toBe("a".repeat(64 * 1024));
  });

  it("fails a case that printed the right answer but exited non-zero", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = (call) =>
      call.command.includes("python3")
        ? {
            stdout: call.options.stdin === "2 7 11 15\n9\n" ? "0 1\n" : "1 2\n",
            stderr: "Killed\n",
            exitCode: 137,
            ms: 300,
          }
        : null;

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result.cases.map((caseResult) => caseResult.pass)).toEqual([
      false,
      false,
    ]);
    expect(result.cases[0]).toMatchObject({
      actual: "0 1\n",
      exitCode: 137,
      stderr: "Killed\n",
    });
  });

  it("shows a Harness that never calls the signed function as a failing case", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = (call) =>
      call.command.includes("python3")
        ? {
            stdout: "",
            stderr:
              "Traceback (most recent call last):\n  File \"main.py\", line 12, in <module>\nNameError: name 'two_sum' is not defined\n",
            exitCode: 1,
            ms: 30,
          }
        : null;

    const result = await runAgainstSamples(
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider },
    );

    expect(result.sandboxError).toBeNull();
    expect(result.compileError).toBeNull();
    expect(result.cases).toHaveLength(2);
    for (const caseResult of result.cases) {
      expect(caseResult.pass).toBe(false);
      expect(caseResult.exitCode).toBe(1);
      expect(caseResult.stderr).toContain("NameError");
    }
  });

  it("appends the Harness server-side, in a directory of its own per run", async () => {
    const problem = await seedPythonProblem();
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonRunner({});

    const run = (now?: Date) =>
      runAgainstSamples(
        { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
        { provider, now },
      );

    const fixedNow = new Date("2026-10-28T10:00:00.000Z");
    await run(fixedNow);
    await run(fixedNow);

    const files = provider.written.filter((file) => file.path.endsWith("/main.py"));
    expect(files).toHaveLength(2);

    for (const file of files) {
      // The organizer pastes only their solution; the file under test also
      // carries the hidden Harness, appended on the server.
      // `assembleRunProgram` appends the Harness after the solution's own newline.
      expect(file.content).toBe(`${PYTHON_SOLUTION}${PYTHON_HARNESS}`);
      expect(file.path).toMatch(/^\/work\/\d+-[0-9a-f-]{36}\/main\.py$/);
      // The server clock names the run's directory, so tests can move it.
      expect(file.path).toContain(`/work/${fixedNow.getTime()}-`);
    }
    expect(files[0].path).not.toBe(files[1].path);

    // Every case ran in the directory its file was written to.
    const rundirs = provider.runs
      .filter((call) => call.command.includes("python3"))
      .map((call) => call.command);
    expect(rundirs[0]).toContain(files[0].path);
    expect(rundirs[2]).toContain(files[1].path);
  });
});

describe("organizer test panel", () => {
  const organizer = testUser({ email: "organizer@example.com" });
  const otherOrganizer = testUser({ email: "co-organizer@example.com" });
  const participant = testUser({ email: "solver@example.com" });

  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = `${organizer.email},${otherOrganizer.email}`;
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it("runs an organizer's own problem and returns the participant shape", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      status: "live",
    });
    const problem = await insertProblem(event.id, { title: "Two Sum" });
    await insertStarter(
      problem.id,
      "python",
      "def two_sum(nums, target):\n    pass\n",
      "print(*two_sum([2, 7], 9))\n",
    );
    for (const [index, sample] of twoCases.entries()) {
      await insertTestCase(
        problem.id,
        (index + 1) as 1 | 2,
        sample.input,
        sample.expectedOutput,
      );
    }

    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonRunner({
      "2 7 11 15\n9\n": "0 1\n",
      "3 2 4\n6\n": "1 2\n",
    });

    const result = await testProblem(
      { id: organizer.id, email: organizer.email },
      {
        eventId: event.id,
        problemId: problem.id,
        language: "python",
        code: PYTHON_SOLUTION,
      },
      { provider },
    );

    // Testing is read-only, so a live event is not a refusal.
    expect(result).toMatchObject({
      compileError: null,
      timedOut: false,
      sandboxError: null,
    });
    expect(result.cases.map((caseResult) => caseResult.pass)).toEqual([
      true,
      true,
    ]);
  });

  it("keeps the Harness out of the response", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    const problem = await insertProblem(event.id, { title: "Two Sum" });
    const secretHarness = "# HARNESS_SECRET_MARKER\nprint(42)\n";
    await insertStarter(problem.id, "python", "pass\n", secretHarness);
    for (const [index, sample] of twoCases.entries()) {
      await insertTestCase(
        problem.id,
        (index + 1) as 1 | 2,
        sample.input,
        sample.expectedOutput,
      );
    }

    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });

    const result = await testProblem(
      { id: organizer.id, email: organizer.email },
      {
        eventId: event.id,
        problemId: problem.id,
        language: "python",
        code: "pass\n",
      },
      { provider },
    );

    const written = provider.written.map((file) => file.content).join("\n");
    expect(written).toContain("HARNESS_SECRET_MARKER");
    expect(JSON.stringify(result)).not.toContain("HARNESS_SECRET_MARKER");
  });

  it("refuses a participant", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    const problem = await insertProblem(event.id);

    await expect(
      testProblem(
        { id: participant.id, email: participant.email },
        {
          eventId: event.id,
          problemId: problem.id,
          language: "python",
          code: "pass\n",
        },
      ),
    ).rejects.toMatchObject({ code: "not_organizer", status: 403 });
  });

  it("hides another organizer's problem behind a 404", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    const problem = await insertProblem(event.id);

    await expect(
      testProblem(
        { id: otherOrganizer.id, email: otherOrganizer.email },
        {
          eventId: event.id,
          problemId: problem.id,
          language: "python",
          code: "pass\n",
        },
      ),
    ).rejects.toMatchObject({ code: "problem_not_found", status: 404 });
  });

  it("refuses a problem that belongs to a different event", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    const otherEvent = await insertEvent({
      createdBy: organizer.id,
      code: "XYZ789",
    });
    const problem = await insertProblem(otherEvent.id);

    await expect(
      testProblem(
        { id: organizer.id, email: organizer.email },
        {
          eventId: event.id,
          problemId: problem.id,
          language: "python",
          code: "pass\n",
        },
      ),
    ).rejects.toMatchObject({ code: "problem_not_found", status: 404 });
  });
});

describe("Test this problem panel", () => {
  const failingHarnessRun: RunResult = {
    compileError: null,
    timedOut: false,
    sandboxError: null,
    cases: [
      {
        index: 0,
        input: "2 7 11 15\n9\n",
        expected: "0 1\n",
        actual: "",
        stderr:
          "Traceback (most recent call last):\n  File \"main.py\", line 12, in <module>\nNameError: name 'two_sum' is not defined\n",
        exitCode: 1,
        ms: 34,
        pass: false,
      },
      {
        index: 1,
        input: "3 2 4\n6\n",
        expected: "1 2\n",
        actual: "",
        stderr:
          "Traceback (most recent call last):\n  File \"main.py\", line 12, in <module>\nNameError: name 'two_sum' is not defined\n",
        exitCode: 1,
        ms: 29,
        pass: false,
      },
    ],
  };

  it("shows a broken Harness as a failing case with its stderr, not a crash", () => {
    const html = renderToStaticMarkup(
      createElement(RunResultView, { result: failingHarnessRun }),
    );

    expect(html).toContain("Sample 1");
    expect(html).toContain("Sample 2");
    expect(html).toContain("Fail");
    expect(html).toContain("0 of 2");
    expect(html).toContain("NameError: name &#x27;two_sum&#x27; is not defined");
    expect(html).toContain("0 1"); // the expected output
    expect(html).toContain("exit 1");
    expect(html).toContain("34 ms");
  });

  it("renders a compile error once, with no case blocks", () => {
    const html = renderToStaticMarkup(
      createElement(RunResultView, {
        result: {
          compileError: "main.cpp:3:1: error: expected ';' before '}' token",
          timedOut: false,
          sandboxError: null,
          cases: [],
        },
      }),
    );

    expect(html).toContain("Compile error");
    expect(html).toContain("expected &#x27;;&#x27; before &#x27;}&#x27; token");
    expect(html).not.toContain("Sample 1");
  });

  it("renders a timeout and a sandbox failure", () => {
    const timeout = renderToStaticMarkup(
      createElement(RunResultView, {
        result: {
          compileError: null,
          timedOut: true,
          sandboxError: null,
          cases: [
            {
              index: 0,
              input: "2 7 11 15\n9\n",
              expected: "0 1\n",
              actual: "",
              stderr: "",
              exitCode: null,
              ms: 3_000,
              pass: false,
            },
          ],
        },
      }),
    );
    expect(timeout).toContain("Time limit exceeded");
    expect(timeout).toContain("timed out");
    expect(timeout).toContain("3000 ms");

    const sandbox = renderToStaticMarkup(
      createElement(RunResultView, {
        result: {
          compileError: null,
          timedOut: false,
          sandboxError: "sandbox is not running",
          cases: [],
        },
      }),
    );
    expect(sandbox).toContain("The runner failed");
    expect(sandbox).toContain("sandbox is not running");
  });

  it("accepts a solution per language and never asks for the Harness", () => {
    const html = renderToStaticMarkup(
      createElement(TestProblemPanel, {
        run: async () => ({ error: "not reached" }),
      }),
    );

    expect(html).toContain("Python 3");
    expect(html).toContain("Java");
    expect(html).toContain("C++");
    expect(html).toContain("Reference solution");
    expect(html).toContain("Run samples");
    expect(html).not.toContain("HARNESS_SECRET_MARKER");
  });
});
