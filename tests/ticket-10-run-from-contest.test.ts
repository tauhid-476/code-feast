import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { events, participants, submissions } from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { loadParticipantContext } from "@/lib/participants/queries";
import {
  RUN_CLAIM_STALE_MS,
  RUN_MIN_INTERVAL_MS,
  runFromContest,
} from "@/lib/contest/run";
import { ContestRunOutcome } from "@/components/contest-run-outcome";
import { replenishPool } from "@/lib/runner/pool";
import type { SandboxProvider, SandboxRunResult } from "@/lib/runner/sandbox";
import { db } from "./helpers/db";
import {
  insertEvent,
  insertParticipant,
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

const solver = testUser({ email: "solver@example.com", name: "Sam Solver" });
const startsAt = new Date("2026-10-28T18:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);
const inContest = addMinutes(startsAt, 10);

const SAMPLE_INPUTS = {
  first: "2 7 11 15\n9\n",
  second: "3 2 4\n6\n",
};

const PYTHON_SOLUTION = `def two_sum(nums, target):
    seen = {}
    for index, value in enumerate(nums):
        if target - value in seen:
            return [seen[target - value], index]
        seen[value] = index
    return []
`;

const PYTHON_HARNESS = `# HARNESS_SECRET_MARKER
nums = list(map(int, input().split()))
target = int(input())
print(*two_sum(nums, target))
`;

/** A live event, a solving participant, and one Python problem with two samples. */
async function contest(code: string) {
  const event = await insertEvent({
    code,
    status: "live",
    durationMinutes: 90,
    startsAt,
    deadlineAt,
  });
  const participant = await insertParticipant(event.id, solver, {
    status: "solving",
  });
  const problem = await insertProblem(event.id, { title: "Two Sum" });
  await insertStarter(
    problem.id,
    "python",
    "def two_sum(nums, target):\n    return []\n",
    PYTHON_HARNESS,
  );
  await insertTestCase(problem.id, 1, SAMPLE_INPUTS.first, "0 1\n");
  await insertTestCase(problem.id, 2, SAMPLE_INPUTS.second, "1 2\n");
  const context = await loadParticipantContext(code, solver.id, {
    now: inContest,
  });
  return { event, participant, problem, context };
}

/** A fake Python interpreter: answers each sample's stdin with the expected output. */
function pythonAnswers(answers: Record<string, string>) {
  return (call: FakeRunCall): SandboxRunResult | null => {
    if (!call.command.includes("python3")) return null;
    return {
      stdout: answers[call.options.stdin ?? ""] ?? "",
      stderr: "",
      exitCode: 0,
      ms: 12,
    };
  };
}

/** Holds the interpreter open until the test releases it, so a Run stays in flight. */
function blockingPython() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    handler: async (call: FakeRunCall): Promise<SandboxRunResult | null> => {
      if (!call.command.includes("python3")) return null;
      await gate;
      return {
        stdout: call.options.stdin === SAMPLE_INPUTS.first ? "0 1\n" : "1 2\n",
        stderr: "",
        exitCode: 0,
        ms: 12,
      };
    },
    release: () => release(),
  };
}

async function waitFor(check: () => boolean) {
  // Each DB round trip in this suite crosses the network, so the bound is
  // generous: the fake sandbox is reached as soon as the claim completes.
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("the Run never reached the sandbox");
}

async function participantRow(participantId: string) {
  const [row] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  return row;
}

describe("Run from the contest", () => {
  it("runs the participant's current code against both sample cases", async () => {
    const { problem, context } = await contest("RUN001");
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonAnswers({
      [SAMPLE_INPUTS.first]: "0 1\n",
      [SAMPLE_INPUTS.second]: "1 2\n",
    });

    const result = await runFromContest(
      context,
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider, now: inContest },
    );

    expect(result).toEqual({
      compileError: null,
      timedOut: false,
      sandboxError: null,
      cases: [
        {
          index: 0,
          input: SAMPLE_INPUTS.first,
          expected: "0 1\n",
          actual: "0 1\n",
          stderr: "",
          exitCode: 0,
          ms: 12,
          pass: true,
        },
        {
          index: 1,
          input: SAMPLE_INPUTS.second,
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

  it("records no Submission, adds no strike, and does not lock the participant", async () => {
    const { participant, problem, context } = await contest("RUN002");
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonAnswers({
      [SAMPLE_INPUTS.first]: "0 1\n",
      [SAMPLE_INPUTS.second]: "1 2\n",
    });

    await runFromContest(
      context,
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider, now: inContest },
    );

    const saved = await db
      .select()
      .from(submissions)
      .where(eq(submissions.participantId, participant.id));
    expect(saved).toEqual([]);

    const row = await participantRow(participant.id);
    expect(row).toMatchObject({
      status: "solving",
      lockedAt: null,
      lockoutReason: null,
      strikes: 0,
    });
  });

  it("refuses a second Run while the first is still in flight instead of queueing it", async () => {
    const { problem, context } = await contest("RUN003");
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    const blocker = blockingPython();
    provider.runHandler = blocker.handler;

    const input = {
      problemId: problem.id,
      language: "python",
      code: PYTHON_SOLUTION,
    };

    const first = runFromContest(context, input, {
      provider,
      now: inContest,
    });
    await waitFor(() =>
      provider.runs.some((call) => call.command.includes("python3")),
    );

    await expect(
      runFromContest(context, input, { provider, now: inContest }),
    ).rejects.toMatchObject({ code: "run_in_flight", status: 429 });

    blocker.release();
    const result = await first;
    expect(result.cases.map((caseResult) => caseResult.pass)).toEqual([
      true,
      true,
    ]);

    // The refused Run never reached the sandbox: one Run is two case commands.
    expect(
      provider.runs.filter((call) => call.command.includes("python3")),
    ).toHaveLength(2);
  });

  it("lets the participant Run again only after two seconds", async () => {
    const { problem, context } = await contest("RUN004");
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonAnswers({
      [SAMPLE_INPUTS.first]: "0 1\n",
      [SAMPLE_INPUTS.second]: "1 2\n",
    });

    const input = {
      problemId: problem.id,
      language: "python",
      code: PYTHON_SOLUTION,
    };
    const later = (ms: number) => new Date(inContest.getTime() + ms);

    await runFromContest(context, input, { provider, now: inContest });

    await expect(
      runFromContest(context, input, {
        provider,
        now: later(RUN_MIN_INTERVAL_MS - 1),
      }),
    ).rejects.toMatchObject({ code: "run_too_soon", status: 429 });

    const third = await runFromContest(context, input, {
      provider,
      now: later(RUN_MIN_INTERVAL_MS),
    });
    expect(third.cases.map((caseResult) => caseResult.pass)).toEqual([
      true,
      true,
    ]);

    // Two Runs ran, each with both samples; the refused one never reached a sandbox.
    expect(
      provider.runs.filter((call) => call.command.includes("python3")),
    ).toHaveLength(4);
  });

  it("reclaims a slot left behind by a request that died", async () => {
    const { participant, problem, context } = await contest("RUN007");
    const abandoned = new Date(inContest.getTime() - RUN_CLAIM_STALE_MS - 1_000);
    await db
      .update(participants)
      .set({ runInFlightAt: abandoned })
      .where(eq(participants.id, participant.id));

    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonAnswers({
      [SAMPLE_INPUTS.first]: "0 1\n",
      [SAMPLE_INPUTS.second]: "1 2\n",
    });

    const result = await runFromContest(
      context,
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider, now: inContest },
    );

    expect(result.cases.map((caseResult) => caseResult.pass)).toEqual([
      true,
      true,
    ]);
  });

  it("answers 503 when no sandbox can be claimed, leaving the Deadline alone", async () => {
    const { event, participant, problem, context } = await contest("RUN005");
    // The pool is empty and no sandbox can be created: nothing will ever be
    // ready, so the claim runs out its bound.
    const provider: SandboxProvider = {
      create: async () => {
        throw new Error("E2B refused the sandbox.");
      },
      connect: async () => {
        throw new Error("no sandbox to connect to");
      },
    };

    await expect(
      runFromContest(
        context,
        { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
        { provider, now: inContest, claimTimeoutMs: 50 },
      ),
    ).rejects.toMatchObject({
      code: "runner_busy",
      status: 503,
      message: "The runner is busy, try again in a moment.",
    });

    // The clock is the server's and a failed Run does not touch it.
    const [row] = await db.select().from(events).where(eq(events.id, event.id));
    expect(row.deadlineAt).toEqual(deadlineAt);
    expect(await participantRow(participant.id)).toMatchObject({
      status: "solving",
      lockedAt: null,
    });
    // The busy claim gave its slot back rather than holding it for two minutes.
    expect((await participantRow(participant.id)).runInFlightAt).toBeNull();
  });

  it("keeps the Harness out of the Run response", async () => {
    const { problem, context } = await contest("RUN006");
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runHandler = pythonAnswers({});

    const result = await runFromContest(
      context,
      { problemId: problem.id, language: "python", code: PYTHON_SOLUTION },
      { provider, now: inContest },
    );

    const written = provider.written.map((file) => file.content).join("\n");
    expect(written).toContain("HARNESS_SECRET_MARKER");
    expect(written.startsWith(PYTHON_SOLUTION)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("HARNESS_SECRET_MARKER");
  });
});

describe("Run refusals", () => {
  const INPUT = { language: "python", code: PYTHON_SOLUTION };

  it("refuses a participant whose contest is already locked", async () => {
    const { participant, problem, event } = await contest("REF001");
    await db
      .update(participants)
      .set({
        status: "locked_out",
        lockoutReason: "eliminated",
        lockedAt: inContest,
      })
      .where(eq(participants.id, participant.id));
    const context = await loadParticipantContext("REF001", solver.id, {
      now: inContest,
    });

    await expect(
      runFromContest(context, { ...INPUT, problemId: problem.id }),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
    expect(event.status).toBe("live");
  });

  it("refuses a Run before the event is live", async () => {
    const event = await insertEvent({ code: "REF002", durationMinutes: 90 });
    await insertParticipant(event.id, solver);
    const problem = await insertProblem(event.id);
    const context = await loadParticipantContext("REF002", solver.id);

    await expect(
      runFromContest(context, { ...INPUT, problemId: problem.id }),
    ).rejects.toMatchObject({ code: "contest_not_open", status: 409 });
  });

  it("refuses a viewer who never joined", async () => {
    const { event, problem } = await contest("REF003");
    const stranger = testUser({ email: "stranger@example.com" });
    const context = await loadParticipantContext("REF003", stranger.id, {
      now: inContest,
    });

    expect(context?.participant).toBeNull();
    expect(event.status).toBe("live");
    await expect(
      runFromContest(context, { ...INPUT, problemId: problem.id }),
    ).rejects.toMatchObject({ code: "not_joined", status: 403 });
  });

  it("hides another event's Problem behind a 404", async () => {
    const { context } = await contest("REF004");
    const otherEvent = await insertEvent({ code: "REF005" });
    const otherProblem = await insertProblem(otherEvent.id);

    await expect(
      runFromContest(context, { ...INPUT, problemId: otherProblem.id }),
    ).rejects.toMatchObject({ code: "problem_not_found", status: 404 });
  });
});

describe("the Run verdict in the contest", () => {
  it("shows the server's refusal where the verdict would be", () => {
    const html = renderToStaticMarkup(
      createElement(ContestRunOutcome, {
        error: "The runner is busy, try again in a moment.",
        result: null,
      }),
    );

    expect(html).toContain("Run did not start");
    expect(html).toContain("The runner is busy, try again in a moment.");
  });

  it("shows per-case pass or fail with actual, expected, exit code, and duration", () => {
    const html = renderToStaticMarkup(
      createElement(ContestRunOutcome, {
        error: null,
        result: {
          compileError: null,
          timedOut: false,
          sandboxError: null,
          cases: [
            {
              index: 0,
              input: SAMPLE_INPUTS.first,
              expected: "0 1\n",
              actual: "0 1\n",
              stderr: "",
              exitCode: 0,
              ms: 12,
              pass: true,
            },
            {
              index: 1,
              input: SAMPLE_INPUTS.second,
              expected: "1 2\n",
              actual: "9 9\n",
              stderr: "unused\n",
              exitCode: 0,
              ms: 9,
              pass: false,
            },
          ],
        },
      }),
    );

    expect(html).toContain("Sample 1");
    expect(html).toContain("Sample 2");
    expect(html).toContain("1 of 2");
    expect(html).toContain("9 9"); // actual
    expect(html).toContain("1 2"); // expected
    expect(html).toContain("exit 0");
    expect(html).toContain("12 ms");
    expect(html).toContain("Pass");
    expect(html).toContain("Fail");
    expect(html).toContain("unused"); // stderr
  });
});
