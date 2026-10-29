import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  participants,
  submissionSnippets,
  submissions,
} from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { saveDraft } from "@/lib/drafts/manage";
import { submitConfirmationText } from "@/lib/contest/copy";
import { submitContest } from "@/lib/contest/submit";
import { loadParticipantContext } from "@/lib/participants/queries";
import { contestDestination } from "@/lib/participants/routes";
import { LockedScreen } from "@/components/locked-screen";
import type { Language } from "@/lib/languages";
import { db, useCleanDatabase } from "./helpers/db";
import {
  insertEvent,
  insertParticipant,
  insertProblem,
  testUser,
} from "./helpers/factories";

useCleanDatabase();

const solver = testUser({ email: "solver@example.com", name: "Sam Solver" });
const startsAt = new Date("2026-10-28T18:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);
const inContest = addMinutes(startsAt, 30);
const submittedAt = addMinutes(startsAt, 61);

/** A live event, a solving participant, and two problems with nothing saved. */
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
    joinedAt: startsAt,
  });
  const first = await insertProblem(event.id, {
    position: 1,
    title: "Two Sum",
  });
  const second = await insertProblem(event.id, {
    position: 2,
    title: "Reverse List",
  });
  return { event, participant, first, second };
}

async function autosave(
  code: string,
  participantProblem: { problemId: string; language: Language; code: string },
  at: Date,
) {
  const context = await loadParticipantContext(code, solver.id, { now: at });
  await saveDraft(
    context,
    {
      problemId: participantProblem.problemId,
      language: participantProblem.language,
      code: participantProblem.code,
    },
    { now: at },
  );
}

async function recordedFor(participantId: string) {
  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.participantId, participantId));

  if (!submission) return { submission: null, snippets: [] };

  const snippets = await db
    .select()
    .from(submissionSnippets)
    .where(eq(submissionSnippets.submissionId, submission.id));

  return { submission, snippets };
}

async function participantRow(participantId: string) {
  const [row] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  return row;
}

describe("Submit", () => {
  it("locks the participant and freezes the latest code of every problem", async () => {
    const { participant, first, second } = await contest("SUB001");

    await autosave(
      "SUB001",
      { problemId: first.id, language: "python", code: "def two_sum():\n    pass  # python\n" },
      addMinutes(startsAt, 20),
    );
    // The participant moved to C++ on the first problem; the later language wins.
    await autosave(
      "SUB001",
      { problemId: first.id, language: "cpp", code: "int two_sum() { return 0; }  // cpp\n" },
      addMinutes(startsAt, 30),
    );
    await autosave(
      "SUB001",
      { problemId: second.id, language: "java", code: "class Solution { }  // java\n" },
      addMinutes(startsAt, 40),
    );

    const context = await loadParticipantContext("SUB001", solver.id, {
      now: submittedAt,
    });
    expect(context?.participant?.status).toBe("solving");

    await submitContest(context, { now: submittedAt });

    expect(await participantRow(participant.id)).toMatchObject({
      status: "locked_out",
      lockoutReason: "submitted",
      lockedAt: submittedAt,
    });

    const { submission, snippets } = await recordedFor(participant.id);
    expect(submission).toMatchObject({
      participantId: participant.id,
      reason: "submitted",
      lockedAt: submittedAt,
    });
    expect(snippets).toHaveLength(2);
    expect(
      Object.fromEntries(
        snippets.map((snippet) => [
          snippet.problemId,
          { language: snippet.language, code: snippet.code },
        ]),
      ),
    ).toEqual({
      [first.id]: {
        language: "cpp",
        code: "int two_sum() { return 0; }  // cpp\n",
      },
      [second.id]: {
        language: "java",
        code: "class Solution { }  // java\n",
      },
    });
  });

  it("refuses a second Submit even from the stale view that made the first one", async () => {
    const { participant, first } = await contest("SUB002");
    await autosave(
      "SUB002",
      { problemId: first.id, language: "python", code: "print('once')\n" },
      addMinutes(startsAt, 20),
    );

    const context = await loadParticipantContext("SUB002", solver.id, {
      now: submittedAt,
    });
    await submitContest(context, { now: submittedAt });

    // The browser still holds the page it submitted from; pressing Submit again
    // must not write a second submission.
    await expect(
      submitContest(context, { now: addMinutes(submittedAt, 1) }),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });

    const { submission, snippets } = await recordedFor(participant.id);
    expect(submission).not.toBeNull();
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({
      problemId: first.id,
      code: "print('once')\n",
    });

    // A fresh read is locked too, so the second click is refused by the gate.
    const later = await loadParticipantContext("SUB002", solver.id, {
      now: addMinutes(submittedAt, 2),
    });
    await expect(
      submitContest(later, { now: addMinutes(submittedAt, 2) }),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
    expect((await recordedFor(participant.id)).snippets).toHaveLength(1);
  });

  it("leaves the participant in the contest with nothing recorded when they cancel", async () => {
    const { participant, first } = await contest("SUB003");
    await autosave(
      "SUB003",
      { problemId: first.id, language: "python", code: "print('kept')\n" },
      addMinutes(startsAt, 20),
    );

    const context = await loadParticipantContext("SUB003", solver.id, {
      now: inContest,
    });

    // Cancelling never calls the action: the participant stays put.
    expect(contestDestination(context, { entered: true })).toBeNull();
    expect(await participantRow(participant.id)).toMatchObject({
      status: "solving",
      lockedAt: null,
      lockoutReason: null,
    });
    expect((await recordedFor(participant.id)).submission).toBeNull();
  });

  it("refuses a Submit once the deadline has already locked the participant", async () => {
    const { participant, first } = await contest("SUB004");
    await autosave(
      "SUB004",
      { problemId: first.id, language: "python", code: "print('late')\n" },
      addMinutes(startsAt, 20),
    );

    const context = await loadParticipantContext("SUB004", solver.id, {
      now: addMinutes(deadlineAt, 5),
    });

    await expect(
      submitContest(context, { now: addMinutes(deadlineAt, 5) }),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });

    expect(await participantRow(participant.id)).toMatchObject({
      lockoutReason: "deadline",
      lockedAt: deadlineAt,
    });
  });
});

describe("Submit refusals", () => {
  it("refuses a viewer who never joined", async () => {
    await contest("REF101");
    const stranger = testUser({ email: "stranger@example.com" });
    const context = await loadParticipantContext("REF101", stranger.id, {
      now: inContest,
    });

    expect(context?.participant).toBeNull();
    await expect(
      submitContest(context, { now: inContest }),
    ).rejects.toMatchObject({ code: "not_joined", status: 403 });
  });

  it("refuses a Submit before the event is live", async () => {
    const event = await insertEvent({ code: "REF102", durationMinutes: 90 });
    await insertParticipant(event.id, solver);
    const context = await loadParticipantContext("REF102", solver.id, {
      now: inContest,
    });

    await expect(
      submitContest(context, { now: inContest }),
    ).rejects.toMatchObject({ code: "contest_not_open", status: 409 });
  });
});

describe("the Deadline lockout", () => {
  it("freezes the last autosaved code when the participant returns after the Deadline", async () => {
    const { participant, first, second } = await contest("DL001");

    await autosave(
      "DL001",
      { problemId: first.id, language: "python", code: "answer = 41\n" },
      addMinutes(startsAt, 20),
    );
    await autosave(
      "DL001",
      { problemId: first.id, language: "python", code: "answer = 42\n" },
      addMinutes(startsAt, 80),
    );
    await autosave(
      "DL001",
      { problemId: second.id, language: "cpp", code: "int answer = 42;\n" },
      addMinutes(startsAt, 81),
    );

    // The tab was closed before the Deadline; the first read afterwards must
    // lock them, not leave them open.
    const context = await loadParticipantContext("DL001", solver.id, {
      now: addMinutes(deadlineAt, 7),
    });

    expect(context?.participant).toMatchObject({
      status: "locked_out",
      lockoutReason: "deadline",
      lockedAt: deadlineAt,
    });
    expect(await participantRow(participant.id)).toMatchObject({
      status: "locked_out",
      lockoutReason: "deadline",
      lockedAt: deadlineAt,
    });

    const { submission, snippets } = await recordedFor(participant.id);
    expect(submission).toMatchObject({
      reason: "deadline",
      lockedAt: deadlineAt,
    });
    expect(
      Object.fromEntries(
        snippets.map((snippet) => [snippet.problemId, snippet.code]),
      ),
    ).toEqual({
      [first.id]: "answer = 42\n",
      [second.id]: "int answer = 42;\n",
    });
  });

  it("records a Submit that lands on the Deadline as the Deadline, not as a submit", async () => {
    const { participant, first } = await contest("DL004");
    await autosave(
      "DL004",
      { problemId: first.id, language: "python", code: "still_running = True\n" },
      addMinutes(startsAt, 20),
    );

    // The page was rendered a moment before the clock ran out; the write lands
    // at the Deadline itself.
    const context = await loadParticipantContext("DL004", solver.id, {
      now: new Date(deadlineAt.getTime() - 1_000),
    });

    await submitContest(context, { now: deadlineAt });

    expect(await participantRow(participant.id)).toMatchObject({
      status: "locked_out",
      lockoutReason: "deadline",
      lockedAt: deadlineAt,
    });
    expect((await recordedFor(participant.id)).submission).toMatchObject({
      reason: "deadline",
      lockedAt: deadlineAt,
    });
  });

  it("produces exactly one Submission when several reads reconcile at once", async () => {
    const { participant, first } = await contest("DL002");
    await autosave(
      "DL002",
      { problemId: first.id, language: "python", code: "kept = True\n" },
      addMinutes(startsAt, 20),
    );

    const at = addMinutes(deadlineAt, 1);
    await Promise.all([
      loadParticipantContext("DL002", solver.id, { now: at }),
      loadParticipantContext("DL002", solver.id, { now: at }),
      loadParticipantContext("DL002", solver.id, { now: at }),
    ]);

    const { submission, snippets } = await recordedFor(participant.id);
    expect(submission).not.toBeNull();
    expect(snippets).toHaveLength(1);
    expect(snippets[0].code).toBe("kept = True\n");
  });

  it("sends a locked participant back to the terminal screen", async () => {
    await contest("DL003");
    const context = await loadParticipantContext("DL003", solver.id, {
      now: addMinutes(deadlineAt, 1),
    });

    expect(contestDestination(context, { entered: true })).toBe(
      "/e/DL003/locked",
    );
  });
});

describe("the locked screen", () => {
  it("shows the reason and how long the participant worked", () => {
    const html = renderToStaticMarkup(
      createElement(LockedScreen, {
        eventTitle: "Friday Night Contest",
        participantName: "Sam Solver",
        reason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 61),
      }),
    );

    expect(html).toContain("Friday Night Contest");
    expect(html).toContain("Submitted");
    expect(html).toContain("Elapsed");
    expect(html).toContain("1:01:00");
    expect(html).toContain("can no longer be viewed or changed");
  });

  it("never reads the participant's drafts", () => {
    // The terminal screen is the one participant route that must not touch the
    // code: no drafts, no starter, no editor.
    const source = readFileSync(
      resolve(process.cwd(), "src/app/e/[code]/locked/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/listDrafts|from "@\/lib\/drafts/);
    expect(source).not.toContain("ContestEditor");
  });
});

describe("the Submit confirmation", () => {
  it("says that submitting ends the contest and cannot be undone", () => {
    const copy = submitConfirmationText();
    expect(copy).toContain("ends your contest");
    expect(copy).toContain("cannot be undone");
  });
});
