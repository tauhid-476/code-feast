import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { events } from "@/lib/db/schema";
import {
  createProblem,
  moveProblem,
  updateProblem,
  type ProblemActor,
} from "@/lib/problems/manage";
import { listProblems } from "@/lib/problems/queries";
import { insertEvent, testUser, type TestUser } from "./helpers/factories";
import { db, useCleanDatabase } from "./helpers/db";

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

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("author a problem", () => {
  it("creates a problem on a draft event with a title, an optional difficulty, and a statement", async () => {
    const event = await insertEvent({ createdBy: organizer.id });

    const problem = await createProblem(actor(organizer), event.id, {
      title: "Two Sum",
      difficulty: "Easy",
      statementMd: "Return the indices of the two numbers that add up to the target.",
      sampleCases: twoCases,
    });

    expect(problem.title).toBe("Two Sum");
    expect(problem.difficulty).toBe("Easy");
    expect(problem.position).toBe(1);

    const listed = await listProblems(event.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(problem.id);
    expect(listed[0].statementMd).toContain("indices");
  });

  it("refuses a problem without a title", async () => {
    const event = await insertEvent({ createdBy: organizer.id });

    await expect(
      createProblem(actor(organizer), event.id, {
        title: "   ",
        statementMd: "Find the pair.",
        sampleCases: twoCases,
      }),
    ).rejects.toMatchObject({ code: "title_required" });

    await expect(listProblems(event.id)).resolves.toHaveLength(0);
  });

  it("refuses fewer than two sample test cases with a clear message", async () => {
    const event = await insertEvent({ createdBy: organizer.id });

    await expect(
      createProblem(actor(organizer), event.id, {
        title: "One case",
        statementMd: "Find the pair.",
        sampleCases: [twoCases[0]],
      }),
    ).rejects.toMatchObject({
      code: "sample_cases_missing",
      message: expect.stringContaining("exactly two"),
    });

    await expect(
      createProblem(actor(organizer), event.id, {
        title: "No cases",
        statementMd: "Find the pair.",
        sampleCases: [],
      }),
    ).rejects.toMatchObject({ code: "sample_cases_missing" });

    await expect(listProblems(event.id)).resolves.toHaveLength(0);
  });

  it("refuses more than two sample test cases", async () => {
    const event = await insertEvent({ createdBy: organizer.id });

    await expect(
      createProblem(actor(organizer), event.id, {
        title: "Three cases",
        statementMd: "Find the pair.",
        sampleCases: [...twoCases, { input: "1 1\n2\n", expectedOutput: "0 1\n" }],
      }),
    ).rejects.toMatchObject({
      code: "sample_cases_too_many",
      message: expect.stringContaining("exactly two"),
    });

    await expect(listProblems(event.id)).resolves.toHaveLength(0);
  });

  it("replaces the sample test cases and fields when a problem is edited", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    const problem = await createProblem(actor(organizer), event.id, {
      title: "Two Sum",
      statementMd: "Find the pair.",
      sampleCases: twoCases,
    });

    await updateProblem(actor(organizer), problem.id, {
      title: "Two Sum II",
      difficulty: "Medium",
      statementMd: "Find the pair, now 1-indexed.",
      sampleCases: [
        { input: "1 2 3 4\n5\n", expectedOutput: "1 4\n" },
        { input: "0 0 3 4\n0\n", expectedOutput: "1 2\n" },
      ],
    });

    const [edited] = await listProblems(event.id);
    expect(edited.title).toBe("Two Sum II");
    expect(edited.difficulty).toBe("Medium");
    expect(edited.statementMd).toContain("1-indexed");
    expect(edited.sampleCases.map((sampleCase) => sampleCase.position)).toEqual([
      1, 2,
    ]);
    expect(edited.sampleCases.map((sampleCase) => sampleCase.input)).toEqual([
      "1 2 3 4\n5\n",
      "0 0 3 4\n0\n",
    ]);
    expect(edited.sampleCases[1].expectedOutput).toBe("1 2\n");
  });

  it("persists sample case and problem order across a reload", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    await createProblem(actor(organizer), event.id, {
      title: "First",
      statementMd: "First statement.",
      sampleCases: twoCases,
    });
    await createProblem(actor(organizer), event.id, {
      title: "Second",
      statementMd: "Second statement.",
      sampleCases: [
        { input: "second-a\n", expectedOutput: "A\n" },
        { input: "second-b\n", expectedOutput: "B\n" },
      ],
    });

    const reloaded = await listProblems(event.id);
    expect(reloaded.map((problem) => problem.title)).toEqual([
      "First",
      "Second",
    ]);
    expect(
      reloaded[1].sampleCases.map((sampleCase) => sampleCase.input),
    ).toEqual(["second-a\n", "second-b\n"]);
    expect(reloaded[1].sampleCases.map((sampleCase) => sampleCase.position)).toEqual([
      1, 2,
    ]);
  });

  it("reorders problems and returns the new order", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    for (const title of ["Alpha", "Beta", "Gamma"]) {
      await createProblem(actor(organizer), event.id, {
        title,
        statementMd: `${title} statement.`,
        sampleCases: twoCases,
      });
    }

    const [alpha, beta, gamma] = await listProblems(event.id);

    await moveProblem(actor(organizer), gamma.id, "up");
    expect((await listProblems(event.id)).map((problem) => problem.title)).toEqual([
      "Alpha",
      "Gamma",
      "Beta",
    ]);

    await moveProblem(actor(organizer), gamma.id, "up");
    const reordered = await listProblems(event.id);
    expect(reordered.map((problem) => problem.title)).toEqual([
      "Gamma",
      "Alpha",
      "Beta",
    ]);
    expect(reordered.map((problem) => problem.position)).toEqual([1, 2, 3]);

    await moveProblem(actor(organizer), alpha.id, "down");
    expect((await listProblems(event.id)).map((problem) => problem.title)).toEqual([
      "Gamma",
      "Beta",
      "Alpha",
    ]);

    expect(beta.id).toBe(reordered[2].id);
  });

  it("stores the optional difficulty without any behaviour reading it", async () => {
    const event = await insertEvent({ createdBy: organizer.id });

    const withoutDifficulty = await createProblem(actor(organizer), event.id, {
      title: "No label",
      statementMd: "First statement.",
      sampleCases: twoCases,
    });
    const labelled = await createProblem(actor(organizer), event.id, {
      title: "Hard one",
      difficulty: "Hard",
      statementMd: "Second statement.",
      sampleCases: twoCases,
    });

    expect(withoutDifficulty.difficulty).toBeNull();
    expect(labelled.difficulty).toBe("Hard");

    const listed = await listProblems(event.id);
    expect(listed.map((problem) => problem.difficulty)).toEqual([null, "Hard"]);
    expect(listed.map((problem) => problem.title)).toEqual([
      "No label",
      "Hard one",
    ]);
  });

  it("refuses to author when the event is live", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      status: "live",
    });

    await expect(
      createProblem(actor(organizer), event.id, {
        title: "Before start",
        statementMd: "Statement.",
        sampleCases: twoCases,
      }),
    ).rejects.toMatchObject({ code: "event_not_draft" });

    await expect(listProblems(event.id)).resolves.toHaveLength(0);
  });

  it("refuses create, update, and reorder once the event has ended", async () => {
    const event = await insertEvent({
      createdBy: organizer.id,
      status: "ended",
    });

    await expect(
      createProblem(actor(organizer), event.id, {
        title: "Too late",
        statementMd: "Statement.",
        sampleCases: twoCases,
      }),
    ).rejects.toMatchObject({ code: "event_not_draft" });

    const draft = await insertEvent({
      createdBy: organizer.id,
      code: "DRAFT1",
    });
    const problem = await createProblem(actor(organizer), draft.id, {
      title: "Authored while draft",
      statementMd: "Statement.",
      sampleCases: twoCases,
    });

    // The event moves on after the problem was authored.
    await db
      .update(events)
      .set({ status: "ended" })
      .where(eq(events.id, draft.id));

    await expect(
      updateProblem(actor(organizer), problem.id, {
        title: "Changed",
        statementMd: "Statement.",
        sampleCases: twoCases,
      }),
    ).rejects.toMatchObject({ code: "event_not_draft" });

    await expect(
      moveProblem(actor(organizer), problem.id, "up"),
    ).rejects.toMatchObject({ code: "event_not_draft" });
  });

  it("refuses a participant actor for create, update, and reorder", async () => {
    const event = await insertEvent({ createdBy: organizer.id });
    const problem = await createProblem(actor(organizer), event.id, {
      title: "Organizer's problem",
      statementMd: "Statement.",
      sampleCases: twoCases,
    });

    await expect(
      createProblem(actor(participant), event.id, {
        title: "Participant's problem",
        statementMd: "Statement.",
        sampleCases: twoCases,
      }),
    ).rejects.toMatchObject({ code: "not_organizer" });

    await expect(
      updateProblem(actor(participant), problem.id, {
        title: "Hijacked",
        statementMd: "Statement.",
        sampleCases: twoCases,
      }),
    ).rejects.toMatchObject({ code: "not_organizer" });

    await expect(
      moveProblem(actor(participant), problem.id, "up"),
    ).rejects.toMatchObject({ code: "not_organizer" });

    const [stored] = await listProblems(event.id);
    expect(stored.title).toBe("Organizer's problem");
  });

  it("refuses an event owned by another organizer", async () => {
    const event = await insertEvent({ createdBy: testUser().id });

    await expect(
      createProblem(actor(organizer), event.id, {
        title: "Not mine",
        statementMd: "Statement.",
        sampleCases: twoCases,
      }),
    ).rejects.toMatchObject({ code: "event_not_found" });
  });
});
