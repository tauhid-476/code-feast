import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/events/[id]/review/actions", () => ({
  toggleShortlistAction: vi.fn(),
  setShortlistAction: vi.fn(),
  loadParticipantSubmissionAction: vi.fn(),
  rerunSubmissionAction: vi.fn(),
}));

import { eq } from "drizzle-orm";
import {
  drafts,
  participants,
  submissionSnippets,
  submissions,
  violations,
} from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { replenishPool } from "@/lib/runner/pool";
import type { SandboxRunResult } from "@/lib/runner/sandbox";
import { rerunSubmission } from "@/lib/review/rerun";
import { ParticipantReviewPanel } from "@/components/review-dashboard";
import { db, useCleanDatabase } from "./helpers/db";
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

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

const organizer = testUser({ email: "organizer@example.com" });
const actor = { id: organizer.id, email: organizer.email };
const otherOrganizer = testUser({ email: "other-organizer@example.com" });
const otherOrganizerActor = { id: otherOrganizer.id, email: otherOrganizer.email };
const nonOrganizer = testUser({ email: "participant@example.com" });
const nonOrganizerActor = { id: nonOrganizer.id, email: nonOrganizer.email };

const solver = testUser({ email: "alice@example.com", name: "Alice Solver" });

const startsAt = new Date("2026-10-30T10:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);

const twoCases = [
  { input: "2 7 11 15\n9\n", expectedOutput: "0 1\n" },
  { input: "3 2 4\n6\n", expectedOutput: "1 2\n" },
];

const PYTHON_SOLUTION = `def two_sum(nums, target):
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

function pythonRunner(answers: Record<string, string>) {
  return (call: FakeRunCall): SandboxRunResult | null => {
    if (!call.command.includes("python3")) return null;
    const input = call.options.stdin ?? "";
    return {
      stdout: answers[input] ?? "",
      stderr: "",
      exitCode: 0,
      ms: 15,
    };
  };
}

let eventCodeCounter = 100;

async function seedContestWithProblem(organizerId = organizer.id, customCode?: string) {
  const code = customCode ?? `RERUN${eventCodeCounter++}`;
  const event = await insertEvent({
    createdBy: organizerId,
    code,
    status: "live",
    startsAt,
    deadlineAt,
    durationMinutes: 90,
  });

  const problem = await insertProblem(event.id, {
    title: "Two Sum",
    position: 1,
  });

  await insertStarter(
    problem.id,
    "python",
    "def two_sum(nums, target):\n    pass\n",
    PYTHON_HARNESS,
  );

  for (const [index, sample] of twoCases.entries()) {
    await insertTestCase(
      problem.id,
      (index + 1) as 1 | 2,
      sample.input,
      sample.expectedOutput,
    );
  }

  return { event, problem };
}

beforeEach(() => {
  process.env.ADMIN_EMAILS = `${organizer.email},${otherOrganizer.email}`;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("Ticket 17: Re-run a submission", () => {
  describe("rerunSubmission domain function", () => {
    it("executes submitted code using problem harness and returns RunResult with sample cases", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 40),
      });

      // Insert submission and snippet
      const [sub] = await db
        .insert(submissions)
        .values({
          participantId: p.id,
          lockedAt: addMinutes(startsAt, 40),
          reason: "submitted",
        })
        .returning();

      await db.insert(submissionSnippets).values({
        submissionId: sub.id,
        problemId: problem.id,
        language: "python",
        code: PYTHON_SOLUTION,
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 1 });
      provider.runHandler = pythonRunner({
        "2 7 11 15\n9\n": "0 1\n",
        "3 2 4\n6\n": "1 2\n",
      });

      const result = await rerunSubmission(
        actor,
        {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        },
        { provider },
      );

      expect(result.compileError).toBeNull();
      expect(result.sandboxError).toBeNull();
      expect(result.timedOut).toBe(false);
      expect(result.cases).toHaveLength(2);

      expect(result.cases[0]).toMatchObject({
        index: 0,
        input: twoCases[0].input,
        expected: twoCases[0].expectedOutput,
        actual: "0 1\n",
        pass: true,
        exitCode: 0,
      });

      expect(result.cases[1]).toMatchObject({
        index: 1,
        input: twoCases[1].input,
        expected: twoCases[1].expectedOutput,
        actual: "1 2\n",
        pass: true,
        exitCode: 0,
      });
    });

    it("surfaces failing cases with actual against expected output and stderr", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 40),
      });

      const [sub] = await db
        .insert(submissions)
        .values({
          participantId: p.id,
          lockedAt: addMinutes(startsAt, 40),
          reason: "submitted",
        })
        .returning();

      await db.insert(submissionSnippets).values({
        submissionId: sub.id,
        problemId: problem.id,
        language: "python",
        code: `def two_sum(nums, target):\n    return [0, 0]\n`,
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 1 });
      provider.runHandler = (call: FakeRunCall): SandboxRunResult | null => {
        if (!call.command.includes("python3")) return null;
        return {
          stdout: "0 0\n",
          stderr: "debug log: checking\n",
          exitCode: 0,
          ms: 18,
        };
      };

      const result = await rerunSubmission(
        actor,
        {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        },
        { provider },
      );

      expect(result.compileError).toBeNull();
      expect(result.cases).toHaveLength(2);
      expect(result.cases[0].pass).toBe(false);
      expect(result.cases[0].actual).toBe("0 0\n");
      expect(result.cases[0].expected).toBe(twoCases[0].expectedOutput);
      expect(result.cases[0].stderr).toBe("debug log: checking\n");

      expect(result.cases[1].pass).toBe(false);
      expect(result.cases[1].actual).toBe("0 0\n");
      expect(result.cases[1].expected).toBe(twoCases[1].expectedOutput);
      expect(result.cases[1].stderr).toBe("debug log: checking\n");
    });

    it("surfaces compile errors when submitted code does not compile", async () => {
      const { event, problem } = await seedContestWithProblem();

      // Seed C++ starter to test compilation failure
      await insertStarter(
        problem.id,
        "cpp",
        "int main() {}",
        "// harness",
      );

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 40),
      });

      const [sub] = await db
        .insert(submissions)
        .values({
          participantId: p.id,
          lockedAt: addMinutes(startsAt, 40),
          reason: "submitted",
        })
        .returning();

      await db.insert(submissionSnippets).values({
        submissionId: sub.id,
        problemId: problem.id,
        language: "cpp",
        code: `invalid c++ syntax !!!`,
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 1 });
      provider.runHandler = (call: FakeRunCall): SandboxRunResult | null => {
        if (call.command.includes("g++")) {
          return {
            stdout: "",
            stderr: "solution.cpp:1:1: error: expected unqualified-id\n",
            exitCode: 1,
            ms: 50,
          };
        }
        return null;
      };

      const result = await rerunSubmission(
        actor,
        {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        },
        { provider },
      );

      expect(result.compileError).toContain("error: expected unqualified-id");
      expect(result.cases).toEqual([]);
    });

    it("works for participants locked out via deadline", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "deadline",
        joinedAt: startsAt,
        lockedAt: deadlineAt,
      });

      const [sub] = await db
        .insert(submissions)
        .values({
          participantId: p.id,
          lockedAt: deadlineAt,
          reason: "deadline",
        })
        .returning();

      await db.insert(submissionSnippets).values({
        submissionId: sub.id,
        problemId: problem.id,
        language: "python",
        code: PYTHON_SOLUTION,
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 1 });
      provider.runHandler = pythonRunner({
        "2 7 11 15\n9\n": "0 1\n",
        "3 2 4\n6\n": "1 2\n",
      });

      const result = await rerunSubmission(
        actor,
        {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        },
        { provider },
      );

      expect(result.compileError).toBeNull();
      expect(result.cases).toHaveLength(2);
      expect(result.cases.every((c) => c.pass)).toBe(true);
    });

    it("works for participants locked out via elimination", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "eliminated",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 20),
        strikes: 3,
      });

      const [sub] = await db
        .insert(submissions)
        .values({
          participantId: p.id,
          lockedAt: addMinutes(startsAt, 20),
          reason: "eliminated",
        })
        .returning();

      await db.insert(submissionSnippets).values({
        submissionId: sub.id,
        problemId: problem.id,
        language: "python",
        code: PYTHON_SOLUTION,
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 1 });
      provider.runHandler = pythonRunner({
        "2 7 11 15\n9\n": "0 1\n",
        "3 2 4\n6\n": "1 2\n",
      });

      const result = await rerunSubmission(
        actor,
        {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        },
        { provider },
      );

      expect(result.compileError).toBeNull();
      expect(result.cases).toHaveLength(2);
      expect(result.cases.every((c) => c.pass)).toBe(true);
    });

    it("reconciles deadline lockout before reading if event deadline has passed", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "solving",
        lockoutReason: null,
        joinedAt: startsAt,
        lockedAt: null,
      });

      // Draft exists
      await db.insert(drafts).values({
        participantId: p.id,
        problemId: problem.id,
        language: "python",
        code: PYTHON_SOLUTION,
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 1 });
      provider.runHandler = pythonRunner({
        "2 7 11 15\n9\n": "0 1\n",
        "3 2 4\n6\n": "1 2\n",
      });

      // Running after deadline
      const result = await rerunSubmission(
        actor,
        {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        },
        { provider, now: addMinutes(deadlineAt, 5) },
      );

      expect(result.cases).toHaveLength(2);
      expect(result.cases[0].pass).toBe(true);

      // Verify participant was reconciled to locked_out
      const [updatedP] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, p.id));
      expect(updatedP.status).toBe("locked_out");
      expect(updatedP.lockoutReason).toBe("deadline");
    });

    it("refuses to re-run in-progress participant code", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "solving",
        lockoutReason: null,
        joinedAt: startsAt,
        lockedAt: null,
      });

      await expect(
        rerunSubmission(
          actor,
          {
            eventId: event.id,
            participantId: p.id,
            problemId: problem.id,
          },
          { now: addMinutes(startsAt, 20) },
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "participant_not_locked",
          status: 400,
        }),
      );
    });

    it("refuses if participant did not submit code for the problem", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 30),
      });

      // Submission with no snippets
      await db.insert(submissions).values({
        participantId: p.id,
        lockedAt: addMinutes(startsAt, 30),
        reason: "submitted",
      });

      await expect(
        rerunSubmission(actor, {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "no_code_submitted",
          status: 404,
        }),
      );
    });

    it("refuses non-organizer", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 30),
      });

      await expect(
        rerunSubmission(nonOrganizerActor, {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "not_organizer",
          status: 403,
        }),
      );
    });

    it("refuses organizer who does not own the event", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 30),
      });

      await expect(
        rerunSubmission(otherOrganizerActor, {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "event_not_found",
          status: 404,
        }),
      );
    });

    it("refuses if participant belongs to a different event", async () => {
      const { event: event1, problem } = await seedContestWithProblem();
      const { event: event2 } = await seedContestWithProblem();

      const pInEvent2 = await insertParticipant(event2.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 30),
      });

      await expect(
        rerunSubmission(actor, {
          eventId: event1.id,
          participantId: pInEvent2.id,
          problemId: problem.id,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "participant_not_found",
          status: 404,
        }),
      );
    });

    it("refuses if problem belongs to a different event", async () => {
      const { event: event1 } = await seedContestWithProblem();
      const { event: _event2, problem: problemInEvent2 } =
        await seedContestWithProblem();

      const p = await insertParticipant(event1.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 30),
      });

      await expect(
        rerunSubmission(actor, {
          eventId: event1.id,
          participantId: p.id,
          problemId: problemInEvent2.id,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "problem_not_found",
          status: 404,
        }),
      );
    });

    it("does not mutate participant, submission, drafts, strikes, or violations", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 35),
        strikes: 1,
        shortlisted: false,
      });

      const [sub] = await db
        .insert(submissions)
        .values({
          participantId: p.id,
          lockedAt: addMinutes(startsAt, 35),
          reason: "submitted",
        })
        .returning();

      await db.insert(submissionSnippets).values({
        submissionId: sub.id,
        problemId: problem.id,
        language: "python",
        code: PYTHON_SOLUTION,
      });

      await db.insert(drafts).values({
        participantId: p.id,
        problemId: problem.id,
        language: "python",
        code: "# initial draft\n",
      });

      await db.insert(violations).values({
        participantId: p.id,
        kind: "fullscreen_exit",
        counted: true,
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 1 });
      provider.runHandler = pythonRunner({
        "2 7 11 15\n9\n": "0 1\n",
        "3 2 4\n6\n": "1 2\n",
      });

      // Run
      await rerunSubmission(
        actor,
        {
          eventId: event.id,
          participantId: p.id,
          problemId: problem.id,
        },
        { provider },
      );

      // Verify participant row unchanged
      const [afterP] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, p.id));
      expect(afterP.status).toBe("locked_out");
      expect(afterP.lockoutReason).toBe("submitted");
      expect(afterP.strikes).toBe(1);
      expect(afterP.shortlisted).toBe(false);

      // Verify submission row unchanged
      const [afterSub] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, sub.id));
      expect(afterSub.reason).toBe("submitted");
      expect(afterSub.lockedAt.getTime()).toBe(sub.lockedAt.getTime());

      // Verify draft unchanged
      const [afterDraft] = await db
        .select()
        .from(drafts)
        .where(eq(drafts.participantId, p.id));
      expect(afterDraft.code).toBe("# initial draft\n");

      // Verify violations count unchanged
      const afterViolations = await db
        .select()
        .from(violations)
        .where(eq(violations.participantId, p.id));
      expect(afterViolations).toHaveLength(1);
    });

    it("throws 503 runner_busy when no sandbox is claimable within timeout", async () => {
      const { event, problem } = await seedContestWithProblem();

      const p = await insertParticipant(event.id, solver, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 30),
      });

      const [sub] = await db
        .insert(submissions)
        .values({
          participantId: p.id,
          lockedAt: addMinutes(startsAt, 30),
          reason: "submitted",
        })
        .returning();

      await db.insert(submissionSnippets).values({
        submissionId: sub.id,
        problemId: problem.id,
        language: "python",
        code: PYTHON_SOLUTION,
      });

      // Provider where creation fails
      const provider = new FakeSandboxProvider();
      provider.runError = new Error("Sandbox unavailable");
      provider.createDeadSandboxes = true;

      await expect(
        rerunSubmission(
          actor,
          {
            eventId: event.id,
            participantId: p.id,
            problemId: problem.id,
          },
          { provider, claimTimeoutMs: 50 },
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          code: "runner_busy",
          status: 503,
        }),
      );
    });
  });

  describe("ReviewDashboard & ParticipantReviewPanel UI Component", () => {
    it("renders 'Run submitted code' button and 'Reading aid' notice when code is submitted", () => {
      const detail = {
        participant: {
          id: "p1",
          eventId: "e1",
          userId: "u1",
          displayName: "Alice Solver",
          email: "alice@example.com",
          status: "locked_out" as const,
          joinedAt: startsAt,
          lockedAt: addMinutes(startsAt, 40),
          lockoutReason: "submitted" as const,
          strikes: 0,
          shortlisted: false,
          activeSessionId: null,
          elapsedSeconds: 2400,
        },
        submission: {
          id: "s1",
          lockedAt: addMinutes(startsAt, 40),
          reason: "submitted",
          createdAt: addMinutes(startsAt, 40),
        },
        snippets: [
          {
            problemId: "prob1",
            problemTitle: "Two Sum",
            position: 1,
            language: "python",
            code: "print('hello')",
          },
        ],
        violations: [],
      };

      const html = renderToStaticMarkup(
        createElement(ParticipantReviewPanel, {
          detail,
          eventId: "e1",
          onClose: () => {},
          onToggleShortlist: () => {},
        }),
      );

      expect(html).toContain("Run submitted code");
      expect(html).toContain("Re-run against sample test cases");
      expect(html).toContain("Reading aid");
      expect(html).toContain(
        "Reading aid — runs code against sample test cases and produces no verdict or score.",
      );
    });

    it("does NOT render 'Run submitted code' when no code was submitted for the problem", () => {
      const detail = {
        participant: {
          id: "p1",
          eventId: "e1",
          userId: "u1",
          displayName: "Bob Solver",
          email: "bob@example.com",
          status: "locked_out" as const,
          joinedAt: startsAt,
          lockedAt: addMinutes(startsAt, 40),
          lockoutReason: "submitted" as const,
          strikes: 0,
          shortlisted: false,
          activeSessionId: null,
          elapsedSeconds: 2400,
        },
        submission: {
          id: "s1",
          lockedAt: addMinutes(startsAt, 40),
          reason: "submitted",
          createdAt: addMinutes(startsAt, 40),
        },
        snippets: [
          {
            problemId: "prob2",
            problemTitle: "Reverse String",
            position: 2,
            language: null,
            code: null,
          },
        ],
        violations: [],
      };

      const html = renderToStaticMarkup(
        createElement(ParticipantReviewPanel, {
          detail,
          eventId: "e1",
          onClose: () => {},
          onToggleShortlist: () => {},
        }),
      );

      expect(html).not.toContain("Run submitted code");
      expect(html).not.toContain("Re-run against sample test cases");
      expect(html).toContain("No code submitted for this problem.");
    });
  });
});
