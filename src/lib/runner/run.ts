import { randomUUID } from "node:crypto";
import type { Language } from "@/lib/languages";
import { assembleRunProgram } from "@/lib/problems/program";
import { withClaimedSandbox } from "@/lib/runner/pool";
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  SandboxTimeoutError,
  type SandboxHandle,
  type SandboxProvider,
  type SandboxRunResult,
} from "@/lib/runner/sandbox";
import { now as serverNow } from "@/lib/time";

/**
 * One Run: the submitted code plus the hidden Harness, compiled and executed
 * against a Problem's two Sample Test Cases.
 *
 * This module is the only Run implementation. The organizer's test panel, a
 * participant's Run, and a re-run all call `runAgainstSamples` and render the
 * same SPEC §7 shape, so what an organizer rehearses is exactly what a
 * participant sees on the day.
 */

export type RunCaseResult = {
  /** Zero-based position among the Sample Test Cases. */
  index: number;
  input: string;
  expected: string;
  actual: string;
  stderr: string;
  /** `null` when the case never produced an exit code, e.g. a timeout. */
  exitCode: number | null;
  ms: number;
  pass: boolean;
};

export type RunResult = {
  compileError: string | null;
  timedOut: boolean;
  sandboxError: string | null;
  cases: RunCaseResult[];
};

export type RunInput = {
  problemId: string;
  language: string;
  /** The code under test, without the Harness: assembly is server-side. */
  code: string;
};

export type RunOptions = {
  /** The transport seam; tests inject a fake so no E2B key is needed. */
  provider?: SandboxProvider;
  /**
   * The server clock. A Run's working directory carries it, so an artifact
   * left behind by a crashed run can be dated; tests can move it.
   */
  now?: Date;
  /**
   * How long a claim waits for a sandbox before the Run answers 503. SPEC §7
   * fixes it at 20s; tests shorten it so the bound is exercised, not slept.
   */
  claimTimeoutMs?: number;
  /** Scopes sandbox claim to the event's warm pool / BYOK key. */
  eventId?: string;
};

/** Python/C++ get 3s per case; Java gets 6s because the JVM must start. */
const SMALL_CASE_TIMEOUT_MS = 3_000;
const JAVA_CASE_TIMEOUT_MS = 6_000;

/** Compile is allowed 15s, the same default the transport uses. */
export const COMPILE_TIMEOUT_MS = DEFAULT_COMMAND_TIMEOUT_MS;

/** A command that only prepares the working directory. */
const SETUP_TIMEOUT_MS = 5_000;

/**
 * stdout (and stderr) are cut at 64KB before they enter the response, so a
 * program printing in a loop cannot bloat the Server Action payload.
 */
export const OUTPUT_LIMIT_BYTES = 64 * 1024;

/**
 * Memory is enforced in the command itself, since the sandbox has no cgroup
 * per command. `ulimit -v` caps virtual address space in KB, so 256MB becomes
 * 262144; a runaway allocation dies inside the process instead of the whole
 * sandbox. Java is different: `ulimit -v` breaks JVM startup, so the heap is
 * capped with `-Xmx512m` and the rest of the JVM is left alone.
 */
const SMALL_MEMORY_KB = 256 * 1024;
const JAVA_HEAP = "512m";

type LanguageRunner = {
  /** The file the organizer's code plus the Harness is written to. */
  fileName: string;
  /** Compiles once before the cases; absent when the language has no step. */
  compileCommand?: (dir: string) => string;
  /** Runs one case, reading its input from stdin. */
  runCommand: (dir: string) => string;
  caseTimeoutMs: number;
};

/**
 * The per-language command table. Python's interpreter compiles as it starts,
 * so a Python syntax error arrives as a failing case with the traceback on
 * stderr rather than as a compile error; C++ and Java compile up front.
 */
const LANGUAGE_RUNNERS: Record<Language, LanguageRunner> = {
  python: {
    fileName: "main.py",
    runCommand: (dir) =>
      `sh -c 'ulimit -v ${SMALL_MEMORY_KB}; exec python3 ${dir}/main.py'`,
    caseTimeoutMs: SMALL_CASE_TIMEOUT_MS,
  },
  cpp: {
    fileName: "main.cpp",
    compileCommand: (dir) =>
      `g++ -O2 -std=c++17 -o ${dir}/main ${dir}/main.cpp`,
    runCommand: (dir) =>
      `sh -c 'ulimit -v ${SMALL_MEMORY_KB}; exec ${dir}/main'`,
    caseTimeoutMs: SMALL_CASE_TIMEOUT_MS,
  },
  java: {
    fileName: "Main.java",
    compileCommand: (dir) => `javac -d ${dir} ${dir}/Main.java`,
    runCommand: (dir) => `java -Xmx${JAVA_HEAP} -cp ${dir} Main`,
    caseTimeoutMs: JAVA_CASE_TIMEOUT_MS,
  },
};

function emptyResult(): RunResult {
  return { compileError: null, timedOut: false, sandboxError: null, cases: [] };
}

/**
 * Trailing whitespace is ignored on both sides, because `print` adds a newline
 * that a human would not author into an expected output. Leading whitespace is
 * significant and is compared as written.
 */
function trimTrailingWhitespace(text: string): string {
  return text.replace(/\s+$/, "");
}

function outputMatches(actual: string, expected: string): boolean {
  return trimTrailingWhitespace(actual) === trimTrailingWhitespace(expected);
}

/** Cuts text to 64KB of UTF-8 without leaving half a character behind. */
function truncateOutput(text: string): string {
  if (Buffer.byteLength(text, "utf8") <= OUTPUT_LIMIT_BYTES) return text;
  const buffer = Buffer.from(text, "utf8").subarray(0, OUTPUT_LIMIT_BYTES);
  return buffer.toString("utf8").replace(/\uFFFD+$/, "");
}

function describeSandboxError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The sandbox failed while running this code.";
}

function compileFailureMessage(result: SandboxRunResult): string {
  const output = result.stderr.trim() ? result.stderr : result.stdout;
  const message = truncateOutput(output);
  if (message.trim()) return message;
  return `Compilation failed with exit code ${result.exitCode}.`;
}

/**
 * Runs one case. A timeout is a normal outcome: the case fails, the Run
 * continues. Anything else that throws is a dead sandbox and ends the Run with
 * no case for that index — an attempt that produced nothing is not a result.
 */
async function runCase(
  handle: SandboxHandle,
  runner: LanguageRunner,
  dir: string,
  index: number,
  sample: { input: string; expected: string },
): Promise<{ case?: RunCaseResult; sandboxError?: string }> {
  try {
    const result = await handle.run(runner.runCommand(dir), {
      stdin: sample.input,
      timeoutMs: runner.caseTimeoutMs,
    });
    const actual = truncateOutput(result.stdout);
    return {
      case: {
        index,
        input: sample.input,
        expected: sample.expected,
        actual,
        stderr: truncateOutput(result.stderr),
        exitCode: result.exitCode,
        ms: result.ms,
        pass: result.exitCode === 0 && outputMatches(actual, sample.expected),
      },
    };
  } catch (error) {
    if (error instanceof SandboxTimeoutError) {
      return {
        case: {
          index,
          input: sample.input,
          expected: sample.expected,
          actual: truncateOutput(error.stdout),
          stderr: truncateOutput(error.stderr),
          exitCode: null,
          // The case burned its whole allowance; that is its duration.
          ms: runner.caseTimeoutMs,
          pass: false,
        },
      };
    }

    return { sandboxError: describeSandboxError(error) };
  }
}

/**
 * Compiles the assembled file once, when the language needs it. Returns a
 * finished result for the caller on failure, or `null` when the cases can run.
 */
async function compileIfNeeded(
  handle: SandboxHandle,
  runner: LanguageRunner,
  dir: string,
): Promise<RunResult | null> {
  if (!runner.compileCommand) return null;

  try {
    const compiled = await handle.run(runner.compileCommand(dir), {
      timeoutMs: COMPILE_TIMEOUT_MS,
    });
    if (compiled.exitCode === 0) return null;

    // One compile error, no cases: nothing ran, so nothing may be reported.
    return {
      compileError: compileFailureMessage(compiled),
      timedOut: false,
      sandboxError: null,
      cases: [],
    };
  } catch (error) {
    if (error instanceof SandboxTimeoutError) {
      return {
        compileError: `Compilation took longer than ${COMPILE_TIMEOUT_MS / 1000}s and was stopped.`,
        timedOut: true,
        sandboxError: null,
        cases: [],
      };
    }
    return { ...emptyResult(), sandboxError: describeSandboxError(error) };
  }
}

export async function runAgainstSamples(
  input: RunInput,
  options: RunOptions = {},
): Promise<RunResult> {
  // Read the Harness and the sample cases before claiming a sandbox: the two
  // database reads must not hold a warm sandbox hostage. `assembleRunProgram`
  // is the only place the hidden Harness is read, and it appends it here,
  // server-side, so the submitted code never has to carry it.
  const program = await assembleRunProgram(
    input.problemId,
    input.language,
    input.code,
  );
  const runner = LANGUAGE_RUNNERS[program.language];
  const startedAt = options.now ?? serverNow();

  return withClaimedSandbox(
    {
      provider: options.provider,
      timeoutMs: options.claimTimeoutMs,
      eventId: options.eventId,
    },
    async ({ handle }) => {
      const result = emptyResult();
      // The sandbox is reused by every Run, so this Run owns one directory:
      // no stale source, binary, or class file can leak into the next Run.
      const dir = `/work/${startedAt.getTime()}-${randomUUID()}`;

      try {
        await handle.run(`mkdir -p ${dir}`, { timeoutMs: SETUP_TIMEOUT_MS });
        await handle.writeFile(`${dir}/${runner.fileName}`, program.source);
      } catch (error) {
        result.sandboxError = describeSandboxError(error);
        return result;
      }

      const compileFailure = await compileIfNeeded(handle, runner, dir);
      if (compileFailure) return compileFailure;

      for (let index = 0; index < program.sampleCases.length; index += 1) {
        const sample = program.sampleCases[index];
        const outcome = await runCase(handle, runner, dir, index, {
          input: sample.input,
          expected: sample.expectedOutput,
        });
        if (outcome.case) result.cases.push(outcome.case);

        if (outcome.sandboxError) {
          // The sandbox is gone; later cases cannot run. Earlier cases are real
          // results and are still reported.
          result.sandboxError = outcome.sandboxError;
          return result;
        }
      }

      result.timedOut = result.cases.some(
        (caseResult) => caseResult.exitCode === null,
      );
      return result;
    },
  );
}
