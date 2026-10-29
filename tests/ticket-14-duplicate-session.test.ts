import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  drafts as draftsTable,
  participants,
  submissionSnippets,
  submissions,
  violations,
} from "@/lib/db/schema";
import { startContestSession } from "@/lib/contest/session";
import { runFromContest } from "@/lib/contest/run";
import { submitContest } from "@/lib/contest/submit";
import { sessionTakeoverText } from "@/lib/contest/copy";
import { listDrafts, saveDraft } from "@/lib/drafts/manage";
import { countParticipants } from "@/lib/participants/lockout";
import { loadParticipantContext } from "@/lib/participants/queries";
import { contestDestination } from "@/lib/participants/routes";
import {
  isActiveSession,
  requireActiveSession,
} from "@/lib/participants/session";
import { REPORTABLE_VIOLATION_KINDS } from "@/lib/violations/kinds";
import { recordHeartbeat } from "@/lib/violations/heartbeat";
import { recordStrike } from "@/lib/violations/strikes";
import { SessionTakeover } from "@/components/session-takeover";
import { addMinutes } from "@/lib/time";
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
const inContest = addMinutes(startsAt, 10);

/** Two browser sessions for one Participant: the gate each one came through. */
const FIRST = "4a2f6bd1-0000-4000-8000-000000000001";
const SECOND = "4a2f6bd1-0000-4000-8000-000000000002";
const THIRD = "4a2f6bd1-0000-4000-8000-000000000003";

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
  const problem = await insertProblem(event.id, { position: 1 });
  return { event, participant, problem };
}

async function contextAt(code: string, at: Date) {
  return loadParticipantContext(code, solver.id, { now: at });
}

async function participantRow(participantId: string) {
  const [row] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  return row;
}

async function loggedViolations(participantId: string) {
  return db
    .select()
    .from(violations)
    .where(eq(violations.participantId, participantId))
    .orderBy(violations.createdAt);
}

async function savedDraftRows(participantId: string) {
  return db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.participantId, participantId));
}

describe("opening the contest a second time", () => {
  it("makes the newest session the active one and charges one strike", async () => {
    const { participant } = await contest("DUP001");
    const first = await contextAt("DUP001", inContest);
    const at = addMinutes(startsAt, 20);

    const opening = await startContestSession(
      first,
      { sessionId: FIRST },
      { now: inContest },
    );
    expect(opening).toMatchObject({ takeover: false, counted: false, strikes: 0 });

    const second = await startContestSession(
      await contextAt("DUP001", at),
      { sessionId: SECOND },
      { now: at },
    );

    expect(second).toMatchObject({
      takeover: true,
      counted: true,
      strikes: 1,
      status: "solving",
      eliminated: false,
    });
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: SECOND,
      strikes: 1,
      status: "solving",
      lockoutReason: null,
    });

    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "duplicate_session",
      counted: true,
      createdAt: at,
    });
  });

  it("treats a refresh of the same session as the same session", async () => {
    const { participant } = await contest("DUP002");
    const context = await contextAt("DUP002", inContest);

    await startContestSession(context, { sessionId: FIRST }, { now: inContest });
    const again = await startContestSession(
      await contextAt("DUP002", addMinutes(startsAt, 11)),
      { sessionId: FIRST },
      { now: addMinutes(startsAt, 11) },
    );

    expect(again).toMatchObject({ takeover: false, counted: false, strikes: 0 });
    expect(await loggedViolations(participant.id)).toEqual([]);
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: FIRST,
      strikes: 0,
    });
  });

  it("makes the older session read-only: no autosave, Run, or Submit", async () => {
    const { problem } = await contest("DUP003");
    const takeoverAt = addMinutes(startsAt, 20);
    await startContestSession(
      await contextAt("DUP003", inContest),
      { sessionId: FIRST },
      { now: inContest },
    );
    await startContestSession(
      await contextAt("DUP003", takeoverAt),
      { sessionId: SECOND },
      { now: takeoverAt },
    );

    const older = await contextAt("DUP003", addMinutes(startsAt, 21));
    const at = addMinutes(startsAt, 21);

    await expect(
      saveDraft(
        older,
        { problemId: problem.id, language: "python", code: "old tab\n" },
        { now: at, sessionId: FIRST },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      runFromContest(
        older,
        { problemId: problem.id, language: "python", code: "old tab\n" },
        { now: at, sessionId: FIRST },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      submitContest(older, { now: at, sessionId: FIRST }),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      recordStrike(older, { kind: "focus_lost" }, { now: at, sessionId: FIRST }),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      recordHeartbeat(
        older,
        { fullscreen: true, visibilityState: "visible", entered: true },
        { now: at, sessionId: FIRST },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    // Nothing the older tab tried left a trace.
    expect(await savedDraftRows(older?.participant?.id ?? "")).toEqual([]);
    expect(await loggedViolations(older?.participant?.id ?? "")).toHaveLength(1);
  });

  it("keeps the active session writing", async () => {
    const { problem } = await contest("DUP004");
    const takeoverAt = addMinutes(startsAt, 20);
    await startContestSession(
      await contextAt("DUP004", inContest),
      { sessionId: FIRST },
      { now: inContest },
    );
    await startContestSession(
      await contextAt("DUP004", takeoverAt),
      { sessionId: SECOND },
      { now: takeoverAt },
    );

    const active = await contextAt("DUP004", addMinutes(startsAt, 21));
    const saved = await saveDraft(
      active,
      { problemId: problem.id, language: "python", code: "def solve():\n    pass\n" },
      { now: addMinutes(startsAt, 21), sessionId: SECOND },
    );

    expect(saved.code).toBe("def solve():\n    pass\n");
    expect(await savedDraftRows(active?.participant?.id ?? "")).toHaveLength(1);
  });

  it("keeps exactly one strike when two sessions start together", async () => {
    const { participant } = await contest("DUP005");
    const context = await contextAt("DUP005", inContest);
    const at = addMinutes(startsAt, 20);

    const [left, right] = await Promise.all([
      startContestSession(context, { sessionId: FIRST }, { now: at }),
      startContestSession(context, { sessionId: SECOND }, { now: at }),
    ]);

    expect([left.takeover, right.takeover].filter(Boolean)).toHaveLength(1);
    expect([left.counted, right.counted].filter(Boolean)).toHaveLength(1);

    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "duplicate_session", counted: true });

    const winner = left.takeover ? FIRST : SECOND;
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: winner,
      strikes: 1,
    });
  });

  it("respects the two-second strike window a takeover lands inside", async () => {
    const { participant } = await contest("DUP006");
    await startContestSession(
      await contextAt("DUP006", inContest),
      { sessionId: FIRST },
      { now: inContest },
    );

    const strikeAt = addMinutes(startsAt, 20);
    await recordStrike(
      await contextAt("DUP006", strikeAt),
      { kind: "focus_lost" },
      { now: strikeAt, sessionId: FIRST },
    );

    // The participant switched windows to the second browser: the old tab's
    // blur and the new session's arrival are one event, so one strike.
    const takeover = await startContestSession(
      await contextAt("DUP006", strikeAt),
      { sessionId: SECOND },
      { now: new Date(strikeAt.getTime() + 300) },
    );
    expect(takeover).toMatchObject({ takeover: true, counted: false, strikes: 1 });

    const later = new Date(strikeAt.getTime() + 2_000);
    const second = await startContestSession(
      await contextAt("DUP006", later),
      { sessionId: THIRD },
      { now: later },
    );
    expect(second).toMatchObject({ takeover: true, counted: true, strikes: 2 });

    expect(await loggedViolations(participant.id)).toHaveLength(2);
  });
});

describe("the handover", () => {
  it("preserves the Participant's drafts and refuses the losing overwrite", async () => {
    const { participant, problem } = await contest("DUP007");
    const context = await contextAt("DUP007", inContest);
    await startContestSession(context, { sessionId: FIRST }, { now: inContest });

    const latest = "def two_sum(nums, target):\n    return [0, 1]\n";
    await saveDraft(
      await contextAt("DUP007", addMinutes(startsAt, 20)),
      { problemId: problem.id, language: "python", code: latest },
      { now: addMinutes(startsAt, 20), sessionId: FIRST },
    );

    const takeoverAt = addMinutes(startsAt, 21);
    await startContestSession(
      await contextAt("DUP007", takeoverAt),
      { sessionId: SECOND },
      { now: takeoverAt },
    );

    // The winning session opens on the Participant's latest code.
    const winner = await contextAt("DUP007", addMinutes(startsAt, 22));
    const opened = await listDrafts(winner);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      problemId: problem.id,
      language: "python",
      code: latest,
    });

    // The losing tab cannot overwrite them on its way out.
    await expect(
      saveDraft(
        winner,
        { problemId: problem.id, language: "python", code: "stale\n" },
        { now: addMinutes(startsAt, 22), sessionId: FIRST },
      ),
    ).rejects.toMatchObject({ code: "session_superseded" });

    const rows = await savedDraftRows(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe(latest);
  });

  it("explains the takeover instead of failing silently", async () => {
    expect(isActiveSession({ activeSessionId: null }, FIRST)).toBe(true);
    expect(isActiveSession({ activeSessionId: SECOND }, SECOND)).toBe(true);
    expect(isActiveSession({ activeSessionId: SECOND }, FIRST)).toBe(false);
    expect(isActiveSession({ activeSessionId: SECOND }, null)).toBe(false);

    expect(() =>
      requireActiveSession({ activeSessionId: SECOND }, FIRST),
    ).toThrow(/newer session/i);

    const markup = renderToStaticMarkup(
      createElement(SessionTakeover, {
        eventTitle: "Friday Night Contest",
        participantName: "Sam Solver",
      }),
    );
    expect(markup).toContain(sessionTakeoverText());
    expect(markup).toContain("Friday Night Contest");

    const page = readFileSync(
      resolve(__dirname, "../src/app/e/[code]/contest/page.tsx"),
      "utf8",
    );
    expect(page).toContain("<SessionTakeover");
    expect(page).toContain("isActiveSession");
  });
});

describe("a duplicate as the third strike", () => {
  it("eliminates every session, freezing the code as it was", async () => {
    const { event, participant, problem } = await contest("DUP008");
    await startContestSession(
      await contextAt("DUP008", inContest),
      { sessionId: FIRST },
      { now: inContest },
    );

    const code = "def two_sum(nums, target):\n    return []\n";
    await saveDraft(
      await contextAt("DUP008", addMinutes(startsAt, 20)),
      { problemId: problem.id, language: "python", code },
      { now: addMinutes(startsAt, 20), sessionId: FIRST },
    );

    await recordStrike(
      await contextAt("DUP008", addMinutes(startsAt, 21)),
      { kind: "focus_lost" },
      { now: addMinutes(startsAt, 21), sessionId: FIRST },
    );
    await recordStrike(
      await contextAt("DUP008", addMinutes(startsAt, 22)),
      { kind: "focus_lost" },
      { now: addMinutes(startsAt, 22), sessionId: FIRST },
    );

    const thirdAt = addMinutes(startsAt, 23);
    const outcome = await startContestSession(
      await contextAt("DUP008", thirdAt),
      { sessionId: SECOND },
      { now: thirdAt },
    );

    expect(outcome).toMatchObject({
      takeover: true,
      counted: true,
      strikes: 3,
      eliminated: true,
      status: "locked_out",
    });
    expect(await participantRow(participant.id)).toMatchObject({
      status: "locked_out",
      lockoutReason: "eliminated",
      lockedAt: thirdAt,
      strikes: 3,
    });

    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.participantId, participant.id));
    expect(submission).toMatchObject({ reason: "eliminated", lockedAt: thirdAt });

    const snippets = await db
      .select()
      .from(submissionSnippets)
      .where(eq(submissionSnippets.submissionId, submission.id));
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({ problemId: problem.id, code });

    // Both sessions are locked, not merely superseded.
    const oldSession = await contextAt("DUP008", addMinutes(startsAt, 24));
    const newSession = await contextAt("DUP008", addMinutes(startsAt, 24));
    expect(contestDestination(oldSession, { entered: true })).toBe(
      `/e/${event.code}/locked`,
    );
    expect(contestDestination(newSession, { entered: true })).toBe(
      `/e/${event.code}/locked`,
    );

    for (const sessionId of [FIRST, SECOND]) {
      await expect(
        saveDraft(
          oldSession,
          { problemId: problem.id, language: "python", code: "late\n" },
          { now: addMinutes(startsAt, 24), sessionId },
        ),
      ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
    }

    await expect(
      startContestSession(
        newSession,
        { sessionId: THIRD },
        { now: addMinutes(startsAt, 24) },
      ),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
  });
});

describe("the Organizer's health strip", () => {
  it("counts the active session as solving, not the superseded one", async () => {
    const { event, participant } = await contest("DUP009");
    await startContestSession(
      await contextAt("DUP009", inContest),
      { sessionId: FIRST },
      { now: inContest },
    );
    await startContestSession(
      await contextAt("DUP009", addMinutes(startsAt, 20)),
      { sessionId: SECOND },
      { now: addMinutes(startsAt, 20) },
    );

    expect(await countParticipants(event.id)).toEqual({
      participants: 1,
      solving: 1,
      locked: 0,
    });
    expect(
      await db
        .select()
        .from(participants)
        .where(eq(participants.eventId, event.id)),
    ).toHaveLength(1);
    expect(await participantRow(participant.id)).toMatchObject({
      status: "solving",
      activeSessionId: SECOND,
    });
  });
});

describe("duplicate_session as a server-only kind", () => {
  it("is never a kind the public client may report", () => {
    expect(REPORTABLE_VIOLATION_KINDS).not.toContain("duplicate_session");

    const route = readFileSync(
      resolve(__dirname, "../src/app/api/violation/route.ts"),
      "utf8",
    );
    expect(route).toContain("z.enum(REPORTABLE_VIOLATION_KINDS)");
  });
});
