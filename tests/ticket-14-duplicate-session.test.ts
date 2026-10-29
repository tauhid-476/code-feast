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
import { openContestSession } from "@/lib/contest/session";
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

/** A tab that opens the contest with no session yet: the server mints one. */
async function openTab(code: string, at: Date) {
  return openContestSession(
    await contextAt(code, at),
    { sessionId: null },
    { now: at },
  );
}

/** The same tab reloading: it verifies the id it kept in `sessionStorage`. */
async function reloadTab(code: string, sessionId: string, at: Date) {
  return openContestSession(
    await contextAt(code, at),
    { sessionId },
    { now: at },
  );
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

describe("a session per tab", () => {
  it("mints a server-side id for a tab that has none", async () => {
    const { participant } = await contest("DUP001");

    const tab = await openTab("DUP001", inContest);

    expect(tab.sessionId).toMatch(UUID);
    expect(tab).toMatchObject({
      active: true,
      takeover: false,
      counted: false,
      strikes: 0,
      status: "solving",
    });
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: tab.sessionId,
      strikes: 0,
    });
    expect(await loggedViolations(participant.id)).toEqual([]);
  });

  it("makes a second tab the active one and charges one strike", async () => {
    const { participant } = await contest("DUP002");
    const first = await openTab("DUP002", inContest);
    const at = addMinutes(startsAt, 20);

    const second = await openTab("DUP002", at);

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second).toMatchObject({
      active: true,
      takeover: true,
      counted: true,
      strikes: 1,
      status: "solving",
      eliminated: false,
    });
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: second.sessionId,
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

  it("treats a refresh of the active tab as the same session", async () => {
    const { participant } = await contest("DUP003");
    const tab = await openTab("DUP003", inContest);

    const again = await reloadTab(
      "DUP003",
      tab.sessionId,
      addMinutes(startsAt, 11),
    );

    expect(again).toMatchObject({
      sessionId: tab.sessionId,
      active: true,
      takeover: false,
      counted: false,
      strikes: 0,
    });
    expect(await loggedViolations(participant.id)).toEqual([]);
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: tab.sessionId,
      strikes: 0,
    });
  });

  it("never lets a displaced tab claim the contest back by reloading", async () => {
    const { participant } = await contest("DUP004");
    const first = await openTab("DUP004", inContest);
    const second = await openTab("DUP004", addMinutes(startsAt, 20));

    const reloaded = await reloadTab(
      "DUP004",
      first.sessionId,
      addMinutes(startsAt, 21),
    );

    expect(reloaded).toMatchObject({
      sessionId: first.sessionId,
      active: false,
      takeover: false,
      counted: false,
      strikes: 1,
    });
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: second.sessionId,
      strikes: 1,
    });
    expect(await loggedViolations(participant.id)).toHaveLength(1);
  });

  it("makes the older tab read-only: no autosave, Run, or Submit", async () => {
    const { problem } = await contest("DUP005");
    const first = await openTab("DUP005", inContest);
    await openTab("DUP005", addMinutes(startsAt, 20));

    const older = await contextAt("DUP005", addMinutes(startsAt, 21));
    const at = addMinutes(startsAt, 21);

    await expect(
      saveDraft(
        older,
        { problemId: problem.id, language: "python", code: "old tab\n" },
        { now: at, sessionId: first.sessionId },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      runFromContest(
        older,
        { problemId: problem.id, language: "python", code: "old tab\n" },
        { now: at, sessionId: first.sessionId },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      submitContest(older, { now: at, sessionId: first.sessionId }),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      recordStrike(
        older,
        { kind: "focus_lost" },
        { now: at, sessionId: first.sessionId },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    await expect(
      recordHeartbeat(
        older,
        { fullscreen: true, visibilityState: "visible", entered: true },
        { now: at, sessionId: first.sessionId },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });

    // Nothing the older tab tried left a trace.
    expect(await savedDraftRows(older?.participant?.id ?? "")).toEqual([]);
    expect(await loggedViolations(older?.participant?.id ?? "")).toHaveLength(1);
  });

  it("refuses a write that carries no session id at all", async () => {
    const { problem } = await contest("DUP006");
    await openTab("DUP006", inContest);

    const at = addMinutes(startsAt, 12);
    const context = await contextAt("DUP006", at);

    // Dropping the header must not look like the first tab.
    await expect(
      saveDraft(
        context,
        { problemId: problem.id, language: "python", code: "no id\n" },
        { now: at, sessionId: null },
      ),
    ).rejects.toMatchObject({ code: "session_superseded", status: 409 });
  });

  it("keeps the active session writing", async () => {
    const { problem } = await contest("DUP007");
    await openTab("DUP007", inContest);
    const winner = await openTab("DUP007", addMinutes(startsAt, 20));

    const at = addMinutes(startsAt, 21);
    const saved = await saveDraft(
      await contextAt("DUP007", at),
      { problemId: problem.id, language: "python", code: "def solve():\n    pass\n" },
      { now: at, sessionId: winner.sessionId },
    );

    expect(saved.code).toBe("def solve():\n    pass\n");
    expect(
      await savedDraftRows((await contextAt("DUP007", at))?.participant?.id ?? ""),
    ).toHaveLength(1);
  });

  it("keeps exactly one winner and one strike when two tabs claim together", async () => {
    const { participant } = await contest("DUP008");
    const at = addMinutes(startsAt, 20);

    const [left, right] = await Promise.all([
      openTab("DUP008", at),
      openTab("DUP008", at),
    ]);

    expect([left.takeover, right.takeover].filter(Boolean)).toHaveLength(1);
    expect([left.counted, right.counted].filter(Boolean)).toHaveLength(1);

    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "duplicate_session", counted: true });

    const winner = left.takeover ? left : right;
    expect(await participantRow(participant.id)).toMatchObject({
      activeSessionId: winner.sessionId,
      strikes: 1,
    });
  });

  it("respects the two-second strike window a takeover lands inside", async () => {
    const { participant } = await contest("DUP009");
    const first = await openTab("DUP009", inContest);

    const strikeAt = addMinutes(startsAt, 20);
    await recordStrike(
      await contextAt("DUP009", strikeAt),
      { kind: "focus_lost" },
      { now: strikeAt, sessionId: first.sessionId },
    );

    // The participant switched windows to the new tab: the old tab's blur and
    // the new tab's claim are one event, so one strike.
    const takeover = await openContestSession(
      await contextAt("DUP009", strikeAt),
      { sessionId: null },
      { now: new Date(strikeAt.getTime() + 300) },
    );
    expect(takeover).toMatchObject({
      takeover: true,
      counted: false,
      strikes: 1,
    });

    const later = new Date(strikeAt.getTime() + 2_000);
    const third = await openContestSession(
      await contextAt("DUP009", later),
      { sessionId: null },
      { now: later },
    );
    expect(third).toMatchObject({ takeover: true, counted: true, strikes: 2 });

    expect(await loggedViolations(participant.id)).toHaveLength(2);
  });
});

describe("the handover", () => {
  it("preserves the Participant's drafts and refuses the losing overwrite", async () => {
    const { participant, problem } = await contest("DUP010");
    const first = await openTab("DUP010", inContest);

    const latest = "def two_sum(nums, target):\n    return [0, 1]\n";
    await saveDraft(
      await contextAt("DUP010", addMinutes(startsAt, 20)),
      { problemId: problem.id, language: "python", code: latest },
      { now: addMinutes(startsAt, 20), sessionId: first.sessionId },
    );

    const takeoverAt = addMinutes(startsAt, 21);
    const second = await openTab("DUP010", takeoverAt);

    // The winning tab opens on the Participant's latest code.
    const winner = await contextAt("DUP010", addMinutes(startsAt, 22));
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
        { now: addMinutes(startsAt, 22), sessionId: first.sessionId },
      ),
    ).rejects.toMatchObject({ code: "session_superseded" });

    const rows = await savedDraftRows(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe(latest);
    expect(second.takeover).toBe(true);
  });

  it("explains the takeover instead of failing silently", async () => {
    expect(isActiveSession({ activeSessionId: null }, "any")).toBe(true);
    expect(isActiveSession({ activeSessionId: "tab-b" }, "tab-b")).toBe(true);
    expect(isActiveSession({ activeSessionId: "tab-b" }, "tab-a")).toBe(false);
    expect(isActiveSession({ activeSessionId: "tab-b" }, null)).toBe(false);

    expect(() =>
      requireActiveSession({ activeSessionId: "tab-b" }, "tab-a"),
    ).toThrow(/newer session/i);

    const markup = renderToStaticMarkup(
      createElement(SessionTakeover, {
        eventTitle: "Friday Night Contest",
        participantName: "Sam Solver",
      }),
    );
    expect(markup).toContain(sessionTakeoverText());
    expect(markup).toContain("Friday Night Contest");
    expect(sessionTakeoverText()).toMatch(/another tab/i);

    // The identity is per tab, so it lives in `sessionStorage`, and the page
    // defers the claim to the client gate because a server render cannot see it.
    const gate = readFileSync(
      resolve(__dirname, "../src/components/contest-session-gate.tsx"),
      "utf8",
    );
    expect(gate).toContain("sessionStorage");
    expect(gate).toContain("contestSessionAction");

    const page = readFileSync(
      resolve(__dirname, "../src/app/e/[code]/contest/page.tsx"),
      "utf8",
    );
    expect(page).toContain("<ContestSessionGate");

    // No cookie carries the session identity any more: a cookie is shared by
    // every tab in the browser, which is exactly what this ticket forbids.
    const cookies = readFileSync(
      resolve(__dirname, "../src/lib/participants/gate.ts"),
      "utf8",
    );
    expect(cookies).not.toContain("cf_session_");
    expect(cookies).not.toContain("readContestSession");
  });
});

describe("a duplicate as the third strike", () => {
  it("eliminates every session, freezing the code as it was", async () => {
    const { event, participant, problem } = await contest("DUP011");
    const first = await openTab("DUP011", inContest);

    const code = "def two_sum(nums, target):\n    return []\n";
    await saveDraft(
      await contextAt("DUP011", addMinutes(startsAt, 20)),
      { problemId: problem.id, language: "python", code },
      { now: addMinutes(startsAt, 20), sessionId: first.sessionId },
    );

    await recordStrike(
      await contextAt("DUP011", addMinutes(startsAt, 21)),
      { kind: "focus_lost" },
      { now: addMinutes(startsAt, 21), sessionId: first.sessionId },
    );
    await recordStrike(
      await contextAt("DUP011", addMinutes(startsAt, 22)),
      { kind: "focus_lost" },
      { now: addMinutes(startsAt, 22), sessionId: first.sessionId },
    );

    const thirdAt = addMinutes(startsAt, 23);
    const second = await openTab("DUP011", thirdAt);

    expect(second).toMatchObject({
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

    // Both tabs are locked, not merely superseded.
    const oldSession = await contextAt("DUP011", addMinutes(startsAt, 24));
    const newSession = await contextAt("DUP011", addMinutes(startsAt, 24));
    expect(contestDestination(oldSession, { entered: true })).toBe(
      `/e/${event.code}/locked`,
    );
    expect(contestDestination(newSession, { entered: true })).toBe(
      `/e/${event.code}/locked`,
    );

    for (const sessionId of [first.sessionId, second.sessionId]) {
      await expect(
        saveDraft(
          oldSession,
          { problemId: problem.id, language: "python", code: "late\n" },
          { now: addMinutes(startsAt, 24), sessionId },
        ),
      ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
    }

    await expect(
      openContestSession(
        newSession,
        { sessionId: null },
        { now: addMinutes(startsAt, 24) },
      ),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
  });
});

describe("the Organizer's health strip", () => {
  it("counts the active tab as solving, not the displaced one", async () => {
    const { event, participant } = await contest("DUP012");
    await openTab("DUP012", inContest);
    const second = await openTab("DUP012", addMinutes(startsAt, 20));

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
      activeSessionId: second.sessionId,
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
