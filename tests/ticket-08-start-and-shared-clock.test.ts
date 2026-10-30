import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { startEvent, extendDeadline, endEvent } from "@/lib/events/clock";
import { getEventHealth } from "@/lib/events/live";
import { startConfirmationText } from "@/lib/events/copy";
import {
  moveProblem,
  updateProblem,
  createProblem,
  saveProblemStarter,
} from "@/lib/problems/manage";
import { listContestProblems } from "@/lib/problems/contest";
import { loadParticipantContext } from "@/lib/participants/queries";
import { joinEventByCode } from "@/lib/participants/join";
import { participants, events, runnerPool } from "@/lib/db/schema";
import { db, useCleanDatabase } from "./helpers/db";
import {
  insertEvent,
  insertParticipant,
  insertProblem,
  insertStarter,
  insertTestCase,
  testUser,
} from "./helpers/factories";

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

const organizer = testUser({ email: "organizer@example.com" });
const actor = { id: organizer.id, email: organizer.email };
const solver = testUser({ email: "solver@example.com", name: "Sam Solver" });

const startsAt = new Date("2026-10-28T18:00:00.000Z");

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("start", () => {
  it("sets the start moment and the deadline from the event duration", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "START1",
      durationMinutes: 90,
    });

    const result = await startEvent(actor, event.id, { now: startsAt });

    expect(result.changed).toBe(true);
    expect(result.event.status).toBe("live");
    expect(result.event.startsAt?.toISOString()).toBe(startsAt.toISOString());
    expect(result.event.deadlineAt?.toISOString()).toBe(
      "2026-10-28T19:30:00.000Z",
    );
  });

  it("does not start anything until the organizer presses start", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "WAIT01" });

    expect(event.status).toBe("draft");
    expect(event.startsAt).toBeNull();
    expect(event.deadlineAt).toBeNull();
  });

  it("leaves participants unlocked at the start moment", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "FREEZE" });
    await insertParticipant(event.id, solver);

    await startEvent(actor, event.id, { now: startsAt });

    // Starting a clock is not locking anyone out; only the deadline does that.
    const [row] = await db
      .select()
      .from(participants)
      .where(eq(participants.eventId, event.id));
    expect(row.status).toBe("joined");
    expect(row.lockedAt).toBeNull();
  });

  it("applies a second start as a no-op", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "TWOSTR",
      durationMinutes: 90,
    });

    const first = await startEvent(actor, event.id, { now: startsAt });
    const second = await startEvent(actor, event.id, {
      now: new Date(startsAt.getTime() + 10 * 60_000),
    });

    expect(second.changed).toBe(false);
    expect(second.event.startsAt?.toISOString()).toBe(
      first.event.startsAt?.toISOString(),
    );
    expect(second.event.deadlineAt?.toISOString()).toBe(
      "2026-10-28T19:30:00.000Z",
    );
  });

  it("refuses an organizer who does not own the event", async () => {
    const otherOrganizer = testUser({ email: "other-organizer@example.com" });
    process.env.ADMIN_EMAILS = `${organizer.email},${otherOrganizer.email}`;
    const event = await insertEvent({ createdBy: organizer.id, code: "OWNER1" });

    await expect(
      startEvent(
        { id: otherOrganizer.id, email: otherOrganizer.email },
        event.id,
        { now: startsAt },
      ),
    ).rejects.toMatchObject({ code: "event_not_found", status: 404 });
  });

  it("refuses a participant account", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "NOAUTH" });

    await expect(
      startEvent({ id: solver.id, email: solver.email }, event.id, {
        now: startsAt,
      }),
    ).rejects.toMatchObject({ code: "not_organizer", status: 403 });
  });
});

describe("contest projection", () => {
  it("hides the problem set before start and exposes it from start onward", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "SEEN01" });
    const second = await insertProblem(event.id, {
      position: 2,
      title: "Second problem",
    });
    const first = await insertProblem(event.id, {
      position: 1,
      title: "First problem",
    });
    await insertTestCase(first.id, 1, "1 2\n", "3\n");
    await insertTestCase(first.id, 2, "4 5\n", "9\n");
    await insertStarter(first.id, "python", "def two_sum(nums, target):\n");
    await insertParticipant(event.id, solver);

    const before = await loadParticipantContext("SEEN01", solver.id);
    await expect(listContestProblems(before)).resolves.toEqual([]);

    await startEvent(actor, event.id, { now: startsAt });

    const after = await loadParticipantContext("SEEN01", solver.id, {
      now: startsAt,
    });
    const problems = await listContestProblems(after);

    expect(problems.map((problem) => problem.title)).toEqual([
      "First problem",
      "Second problem",
    ]);
    expect(problems[0].sampleCases.map((c) => c.position)).toEqual([1, 2]);
    expect(problems[0].starters).toEqual([
      { language: "python", starterCode: "def two_sum(nums, target):\n" },
    ]);
    expect(problems[1].sampleCases).toEqual([]);
    expect(second.id).toBe(problems[1].id);
  });

  it("never lets a harness reach a participant-facing projection", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "HARN01" });
    const problem = await insertProblem(event.id);
    await insertTestCase(problem.id, 1);
    await insertTestCase(problem.id, 2);
    await insertStarter(
      problem.id,
      "python",
      "def solve():\n    pass\n",
      "HARNESS_SECRET_123",
    );
    await insertParticipant(event.id, solver);
    await startEvent(actor, event.id, { now: startsAt });

    const context = await loadParticipantContext("HARN01", solver.id, {
      now: startsAt,
    });
    const problems = await listContestProblems(context);

    expect(JSON.stringify(problems)).not.toContain("HARNESS_SECRET_123");
    expect(problems[0].starters[0].starterCode).toContain("def solve");
  });

  it("shows nothing to a viewer who never joined", async () => {
    const event = await insertEvent({ code: "NOJOIN" });
    await insertProblem(event.id);

    const context = await loadParticipantContext("NOJOIN", solver.id);
    await expect(listContestProblems(context)).resolves.toEqual([]);
    await expect(listContestProblems(null)).resolves.toEqual([]);
  });
});

describe("extend", () => {
  async function liveEvent(code: string) {
    const event = await insertEvent({
      createdBy: organizer.id,
      code,
      durationMinutes: 90,
    });
    const started = await startEvent(actor, event.id, { now: startsAt });
    return { event: started.event, id: event.id };
  }

  it("adds ten minutes to the existing deadline", async () => {
    const { event, id } = await liveEvent("EXT001");

    const result = await extendDeadline(actor, id, {
      expectedDeadlineAt: event.deadlineAt!,
      now: new Date(startsAt.getTime() + 30 * 60_000),
    });

    expect(result.changed).toBe(true);
    expect(result.event.deadlineAt?.toISOString()).toBe(
      "2026-10-28T19:40:00.000Z",
    );
  });

  it("is repeatable", async () => {
    const { event, id } = await liveEvent("EXT002");

    const first = await extendDeadline(actor, id, {
      expectedDeadlineAt: event.deadlineAt!,
    });
    const second = await extendDeadline(actor, id, {
      expectedDeadlineAt: first.event.deadlineAt!,
    });

    expect(second.changed).toBe(true);
    expect(second.event.deadlineAt?.toISOString()).toBe(
      "2026-10-28T19:50:00.000Z",
    );
  });

  it("applies a double extend once", async () => {
    const { event, id } = await liveEvent("EXT003");

    const [a, b] = await Promise.all([
      extendDeadline(actor, id, {
        expectedDeadlineAt: event.deadlineAt!,
        now: startsAt,
      }),
      extendDeadline(actor, id, {
        expectedDeadlineAt: event.deadlineAt!,
        now: startsAt,
      }),
    ]);

    expect([a.changed, b.changed].filter(Boolean)).toHaveLength(1);
    const applied = a.changed ? a : b;
    expect(applied.event.deadlineAt?.toISOString()).toBe(
      "2026-10-28T19:40:00.000Z",
    );
  });

  it("is offered only while the event is live", async () => {
    const draft = await insertEvent({ createdBy: organizer.id, code: "EXT004" });

    await expect(
      extendDeadline(actor, draft.id, {
        expectedDeadlineAt: new Date("2026-10-28T19:30:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "event_not_live" });

    const ended = await insertEvent({
      createdBy: organizer.id,
      code: "EXT005",
      status: "ended",
      startsAt,
      deadlineAt: new Date("2026-10-28T19:30:00.000Z"),
      endedAt: new Date("2026-10-28T19:30:00.000Z"),
    });
    await expect(
      extendDeadline(actor, ended.id, {
        expectedDeadlineAt: new Date("2026-10-28T19:30:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "event_not_live" });
  });
});

describe("end now", () => {
  it("moves the deadline to now and locks every participant immediately", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "END001",
      durationMinutes: 90,
    });
    const other = testUser({ email: "other@example.com" });
    const submittedAt = new Date("2026-10-28T18:20:00.000Z");

    await insertParticipant(event.id, solver);
    await insertParticipant(event.id, other);
    await insertParticipant(event.id, testUser({ email: "early@example.com" }), {
      status: "locked_out",
      lockoutReason: "submitted",
      lockedAt: submittedAt,
    });
    await startEvent(actor, event.id, { now: startsAt });

    const endedAt = new Date("2026-10-28T18:40:00.000Z");
    const result = await endEvent(actor, event.id, { now: endedAt });

    expect(result.changed).toBe(true);
    expect(result.event.status).toBe("ended");
    expect(result.event.deadlineAt?.toISOString()).toBe(
      endedAt.toISOString(),
    );

    const [stored] = await db
      .select({ endedAt: events.endedAt })
      .from(events)
      .where(eq(events.id, event.id));
    expect(stored.endedAt?.toISOString()).toBe(endedAt.toISOString());

    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.eventId, event.id));

    const unlocked = rows.filter((row) => row.email !== "early@example.com");
    expect(unlocked).toHaveLength(2);
    for (const row of unlocked) {
      expect(row.status).toBe("locked_out");
      expect(row.lockoutReason).toBe("deadline");
      expect(row.lockedAt?.toISOString()).toBe(endedAt.toISOString());
    }

    // A participant who already submitted keeps their own lockout time and
    // reason; ending the event does not rewrite history.
    const submitted = rows.find((row) => row.email === "early@example.com")!;
    expect(submitted.lockoutReason).toBe("submitted");
    expect(submitted.lockedAt?.toISOString()).toBe(submittedAt.toISOString());
  });

  it("refuses an event that has not started", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "END002" });

    await expect(
      endEvent(actor, event.id, { now: startsAt }),
    ).rejects.toMatchObject({ code: "event_not_live" });
  });

  it("applies a second end as a no-op", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "END003" });
    await startEvent(actor, event.id, { now: startsAt });

    const first = await endEvent(actor, event.id, {
      now: new Date(startsAt.getTime() + 10 * 60_000),
    });
    const second = await endEvent(actor, event.id, {
      now: new Date(startsAt.getTime() + 20 * 60_000),
    });

    expect(second.changed).toBe(false);
    expect(second.event.deadlineAt?.toISOString()).toBe(
      first.event.deadlineAt?.toISOString(),
    );

    const [stored] = await db
      .select({ endedAt: events.endedAt })
      .from(events)
      .where(eq(events.id, event.id));
    expect(stored.endedAt?.toISOString()).toBe(
      new Date(startsAt.getTime() + 10 * 60_000).toISOString(),
    );
  });
});

describe("live health", () => {
  it("counts the roster, solving, and locked, plus sandboxes and time remaining", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "HLTH01",
      durationMinutes: 90,
    });
    await insertParticipant(event.id, solver);
    await insertParticipant(event.id, testUser({ email: "joined@example.com" }));
    await insertParticipant(event.id, testUser({ email: "solving@example.com" }), {
      status: "solving",
    });
    const lockedAt = new Date("2026-10-28T18:10:00.000Z");
    await insertParticipant(event.id, testUser({ email: "locked@example.com" }), {
      status: "locked_out",
      lockoutReason: "submitted",
      lockedAt,
    });
    await db.insert(runnerPool).values([
      { sandboxId: "sandbox-ready-1", state: "ready" },
      { sandboxId: "sandbox-ready-2", state: "ready" },
      { sandboxId: "sandbox-claimed-1", state: "claimed" },
    ]);

    await startEvent(actor, event.id, { now: startsAt });

    const view = await getEventHealth(organizer.id, event.id, {
      now: new Date(startsAt.getTime() + 30 * 60_000),
    });

    expect(view?.health).toEqual({
      participants: 4,
      solving: 1,
      locked: 1,
      readySandboxes: 2,
      secondsRemaining: 60 * 60,
    });
  });

  it("reconciles the whole roster at the deadline before counting", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "HLTH02",
      durationMinutes: 90,
    });
    for (const email of ["a@example.com", "b@example.com", "c@example.com"]) {
      await insertParticipant(event.id, testUser({ email }));
    }
    await startEvent(actor, event.id, { now: startsAt });

    const deadline = new Date("2026-10-28T19:30:00.000Z");
    const view = await getEventHealth(organizer.id, event.id, {
      now: new Date(deadline.getTime() + 5 * 60_000),
    });

    expect(view?.health.participants).toBe(3);
    expect(view?.health.solving).toBe(0);
    expect(view?.health.locked).toBe(3);
    expect(view?.health.secondsRemaining).toBe(0);

    const rows = await db
      .select()
      .from(participants)
      .where(eq(participants.eventId, event.id));
    for (const row of rows) {
      expect(row.lockoutReason).toBe("deadline");
      expect(row.lockedAt?.toISOString()).toBe(deadline.toISOString());
    }
  });

  it("reports no remaining time before the event has a deadline", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "HLTH03" });
    await insertParticipant(event.id, solver);

    const view = await getEventHealth(organizer.id, event.id, { now: startsAt });

    expect(view?.health.secondsRemaining).toBeNull();
  });

  it("returns null for an event the organizer does not own", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "HLTH04" });

    await expect(
      getEventHealth(testUser().id, event.id, { now: startsAt }),
    ).resolves.toBeNull();
  });
});

describe("deadline reconciliation", () => {
  it("locks a participant at the deadline, not when the server noticed", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "REC001",
      durationMinutes: 90,
    });
    await insertParticipant(event.id, solver);
    await startEvent(actor, event.id, { now: startsAt });

    const deadline = new Date("2026-10-28T19:30:00.000Z");
    const noticed = new Date(deadline.getTime() + 95 * 60_000);
    const context = await loadParticipantContext("REC001", solver.id, {
      now: noticed,
    });

    expect(context?.participant?.status).toBe("locked_out");
    expect(context?.participant?.lockoutReason).toBe("deadline");
    expect(context?.participant?.lockedAt?.toISOString()).toBe(
      deadline.toISOString(),
    );
  });

  it("lets a late joiner inherit the existing deadline without prorating it", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "REC002",
      durationMinutes: 90,
    });
    await startEvent(actor, event.id, { now: startsAt });

    const lateJoin = new Date(startsAt.getTime() + 30 * 60_000);
    await joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code: "REC002",
    });

    const context = await loadParticipantContext("REC002", solver.id, {
      now: lateJoin,
    });

    expect(context?.event.deadlineAt?.toISOString()).toBe(
      "2026-10-28T19:30:00.000Z",
    );
    expect(context?.participant?.status).toBe("joined");

    const after = await loadParticipantContext("REC002", solver.id, {
      now: new Date("2026-10-28T19:31:00.000Z"),
    });
    expect(after?.participant?.lockedAt?.toISOString()).toBe(
      "2026-10-28T19:30:00.000Z",
    );
  });

  it("does not move a lockout that already happened", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      code: "REC003",
      durationMinutes: 90,
    });
    const submittedAt = new Date("2026-10-28T18:45:00.000Z");
    await insertParticipant(event.id, solver, {
      status: "locked_out",
      lockoutReason: "submitted",
      lockedAt: submittedAt,
    });
    await startEvent(actor, event.id, { now: startsAt });

    const context = await loadParticipantContext("REC003", solver.id, {
      now: new Date("2026-10-28T19:45:00.000Z"),
    });

    expect(context?.participant?.lockoutReason).toBe("submitted");
    expect(context?.participant?.lockedAt?.toISOString()).toBe(
      submittedAt.toISOString(),
    );
  });
});

describe("start confirmation", () => {
  it("names the current participant count and the duration", () => {
    const copy = startConfirmationText(12, 90);

    expect(copy).toContain("12 participants");
    expect(copy).toContain("90 minutes");
  });

  it("speaks about one participant in the singular", () => {
    expect(startConfirmationText(1, 45)).toContain("1 participant is waiting");
  });

  it("is honest about an empty lobby", () => {
    expect(startConfirmationText(0, 45)).toContain("Nobody has joined yet");
  });
});

describe("freeze", () => {
  const problemInput = {
    title: "Renamed",
    difficulty: "easy",
    statementMd: "New statement.",
    sampleCases: [
      { input: "1\n", expectedOutput: "1\n" },
      { input: "2\n", expectedOutput: "2\n" },
    ],
  };

  it("refuses problem, sample case, starter and harness writes once live", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "FROZ01" });
    const problem = await insertProblem(event.id);
    await insertTestCase(problem.id, 1);
    await insertTestCase(problem.id, 2);
    await insertStarter(
      problem.id,
      "python",
      "def solve():\n    pass\n",
      "HARNESS",
    );

    await startEvent(actor, event.id, { now: startsAt });

    await expect(
      createProblem(actor, event.id, problemInput),
    ).rejects.toMatchObject({ code: "event_not_draft" });
    await expect(
      updateProblem(actor, problem.id, problemInput),
    ).rejects.toMatchObject({ code: "event_not_draft" });
    await expect(
      moveProblem(actor, problem.id, "down"),
    ).rejects.toMatchObject({ code: "event_not_draft" });
    await expect(
      saveProblemStarter(actor, problem.id, "python", {
        starterCode: "def solve():\n    return 1\n",
        harnessCode: "print(solve())\n",
      }),
    ).rejects.toMatchObject({ code: "event_not_draft" });
  });

  it("still allows those writes while the event is a draft", async () => {
    const event = await insertEvent({ createdBy: organizer.id, code: "DRAFT9" });
    const problem = await insertProblem(event.id);
    await insertTestCase(problem.id, 1);
    await insertTestCase(problem.id, 2);

    const updated = await updateProblem(actor, problem.id, problemInput);

    expect(updated.title).toBe("Renamed");
    expect(updated.sampleCases).toHaveLength(2);

    const withStarter = await saveProblemStarter(actor, problem.id, "python", {
      starterCode: "def solve():\n    return 1\n",
      harnessCode: "print(solve())\n",
    });
    expect(
      withStarter.starters.find((pair) => pair.language === "python")
        ?.starterCode,
    ).toContain("return 1");
  });
});
