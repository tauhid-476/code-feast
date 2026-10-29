import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  participants,
  submissionSnippets,
  submissions,
  violations,
} from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { saveDraft } from "@/lib/drafts/manage";
import { joinEventByCode } from "@/lib/participants/join";
import { loadParticipantContext } from "@/lib/participants/queries";
import {
  contestDestination,
  lobbyDestination,
} from "@/lib/participants/routes";
import { logViolation } from "@/lib/violations/log";
import { recordStrike } from "@/lib/violations/strikes";
import { recordHeartbeat } from "@/lib/violations/heartbeat";
import { STRIKE_LIMIT, type CountedViolationKind } from "@/lib/violations/kinds";
import {
  HEARTBEAT_INTERVAL_MS,
  heartbeatReport,
  violatingHeartbeatKinds,
} from "@/lib/contest/heartbeat";
import { StrikeCounter } from "@/components/strike-counter";
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

/** Reports one strike through the domain seam, as the route would. */
async function strikeAt(
  code: string,
  at: Date,
  kind: CountedViolationKind = "focus_lost",
) {
  const context = await contextAt(code, at);
  return recordStrike(context, { kind }, { now: at });
}

describe("a counted strike", () => {
  it("records leaving fullscreen as one counted strike", async () => {
    const { participant } = await contest("STRIKE01");
    const at = addMinutes(startsAt, 31);

    const outcome = await strikeAt("STRIKE01", at, "fullscreen_exit");
    expect(outcome).toMatchObject({ counted: true, strikes: 1, eliminated: false });

    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "fullscreen_exit",
      counted: true,
      createdAt: at,
    });

    expect(await participantRow(participant.id)).toMatchObject({
      status: "solving",
      strikes: 1,
      lockoutReason: null,
    });
  });

  it("records a fullscreen exit and a lost focus as their own kinds", async () => {
    const { participant } = await contest("STRIKE02");
    const hidden = addMinutes(startsAt, 31);
    const exited = addMinutes(startsAt, 31).getTime() + 5_000;

    const context = await contextAt("STRIKE02", hidden);
    await recordStrike(context, { kind: "focus_lost" }, { now: hidden });
    await recordStrike(context, { kind: "fullscreen_exit" }, {
      now: new Date(exited),
    });

    expect((await loggedViolations(participant.id)).map((row) => row.kind)).toEqual([
      "focus_lost",
      "fullscreen_exit",
    ]);
    expect((await participantRow(participant.id)).strikes).toBe(2);
  });

  it("collapses the two events of one alt-tab into one strike", async () => {
    const { participant } = await contest("STRIKE03");
    const at = addMinutes(startsAt, 31);
    const context = await contextAt("STRIKE03", at);

    // `blur` and `fullscreenchange` leave the browser in the same instant, as
    // two requests. Whichever the server handles second must not cost a strike.
    const [first, second] = await Promise.all([
      recordStrike(context, { kind: "fullscreen_exit" }, { now: at }),
      recordStrike(context, { kind: "focus_lost" }, {
        now: new Date(at.getTime() + 80),
      }),
    ]);

    expect([first, second].filter((outcome) => outcome.counted)).toHaveLength(1);
    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].counted).toBe(true);
    expect((await participantRow(participant.id)).strikes).toBe(1);
  });

  it("counts again once the two-second window has passed", async () => {
    const { participant } = await contest("STRIKE04");
    const at = addMinutes(startsAt, 31);
    const context = await contextAt("STRIKE04", at);

    await recordStrike(context, { kind: "focus_lost" }, { now: at });
    await recordStrike(context, { kind: "focus_lost" }, {
      now: new Date(at.getTime() + 2_000),
    });

    expect((await participantRow(participant.id)).strikes).toBe(2);
    expect(await loggedViolations(participant.id)).toHaveLength(2);
  });

  it("logs a blocked attempt next to a strike without costing one", async () => {
    const { participant } = await contest("STRIKE05");
    const at = addMinutes(startsAt, 31);
    const context = await contextAt("STRIKE05", at);

    await recordStrike(context, { kind: "focus_lost" }, { now: at });
    await logViolation(context, { kind: "paste_blocked" }, {
      now: new Date(at.getTime() + 500),
    });

    const rows = await loggedViolations(participant.id);
    expect(rows.map((row) => [row.kind, row.counted])).toEqual([
      ["focus_lost", true],
      ["paste_blocked", false],
    ]);
    expect((await participantRow(participant.id)).strikes).toBe(1);
  });

  it("keeps the count across a refresh and a re-entry of the code", async () => {
    await contest("STRIKE06");
    const at = addMinutes(startsAt, 31);
    await strikeAt("STRIKE06", at);
    const again = new Date(at.getTime() + 2_000);
    await strikeAt("STRIKE06", again);

    // A fresh page load is a new context and a new query; the count is the
    // server's, not the tab's.
    const refreshed = await contextAt("STRIKE06", addMinutes(startsAt, 40));
    expect(refreshed?.participant?.strikes).toBe(2);

    // Re-entering the Join Code returns the same row, still with its strikes.
    const rejoined = await joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code: "STRIKE06",
    });
    expect(rejoined.participantId).toBe(refreshed?.participant?.id);
    expect((await contextAt("STRIKE06", addMinutes(startsAt, 41)))?.participant?.strikes).toBe(2);
  });

  it("refuses a strike from a viewer who never joined", async () => {
    await contest("STRIKE07");
    const stranger = testUser({ email: "stranger@example.com" });
    const context = await loadParticipantContext("STRIKE07", stranger.id, {
      now: inContest,
    });

    await expect(
      recordStrike(context, { kind: "focus_lost" }, { now: inContest }),
    ).rejects.toMatchObject({ code: "not_joined", status: 403 });
  });

  it("records nothing for a signal that arrives after the deadline", async () => {
    const { participant } = await contest("STRIKE08");
    await strikeAt("STRIKE08", addMinutes(startsAt, 31));

    const afterDeadline = addMinutes(deadlineAt, 1);
    const context = await contextAt("STRIKE08", afterDeadline);
    await expect(
      recordStrike(context, { kind: "focus_lost" }, { now: afterDeadline }),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });

    expect(await loggedViolations(participant.id)).toHaveLength(1);
    expect((await participantRow(participant.id)).strikes).toBe(1);
  });
});

describe("elimination", () => {
  it("does not eliminate at two strikes", async () => {
    const { participant } = await contest("ELIM01");
    await strikeAt("ELIM01", addMinutes(startsAt, 31));
    await strikeAt("ELIM01", addMinutes(startsAt, 32));

    expect(await participantRow(participant.id)).toMatchObject({
      status: "solving",
      strikes: 2,
      lockoutReason: null,
      lockedAt: null,
    });
    expect(
      await db.select().from(submissions).where(eq(submissions.participantId, participant.id)),
    ).toEqual([]);
  });

  it("the third strike locks with reason eliminated and freezes the code as it was", async () => {
    const { participant, problem } = await contest("ELIM02");
    const first = addMinutes(startsAt, 31);
    const second = addMinutes(startsAt, 32);
    const third = addMinutes(startsAt, 33);

    const context = await contextAt("ELIM02", addMinutes(startsAt, 30));
    await saveDraft(
      context,
      {
        problemId: problem.id,
        language: "python",
        code: "def solve():\n    return 3\n",
      },
      { now: second },
    );

    await strikeAt("ELIM02", first);
    await strikeAt("ELIM02", second);
    const outcome = await strikeAt("ELIM02", third);

    expect(outcome).toMatchObject({
      counted: true,
      strikes: STRIKE_LIMIT,
      eliminated: true,
      status: "locked_out",
    });

    expect(await participantRow(participant.id)).toMatchObject({
      status: "locked_out",
      strikes: 3,
      lockoutReason: "eliminated",
      lockedAt: third,
    });

    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.participantId, participant.id));
    expect(submission).toMatchObject({ reason: "eliminated", lockedAt: third });

    const snippets = await db
      .select()
      .from(submissionSnippets)
      .where(eq(submissionSnippets.submissionId, submission.id));
    expect(snippets).toHaveLength(1);
    expect(snippets[0]).toMatchObject({
      problemId: problem.id,
      language: "python",
      code: "def solve():\n    return 3\n",
    });

    // The review screen reads one row per strike, with kind and time.
    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => [row.kind, row.counted, row.createdAt])).toEqual([
      ["focus_lost", true, first],
      ["focus_lost", true, second],
      ["focus_lost", true, third],
    ]);
  });

  it("a participant eliminated on one device cannot rejoin from another", async () => {
    const { event } = await contest("ELIM03");
    for (const minute of [31, 32, 33]) {
      await strikeAt("ELIM03", addMinutes(startsAt, minute));
    }

    // Another signed-in session for the same account enters the code again:
    // joining returns the one row, and both participant routes send it to the
    // terminal screen.
    const rejoined = await joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code: "ELIM03",
    });
    const context = await contextAt("ELIM03", addMinutes(startsAt, 34));
    expect(rejoined.eventCode).toBe(event.code);
    expect(context?.participant).toMatchObject({
      id: rejoined.participantId,
      status: "locked_out",
      lockoutReason: "eliminated",
    });
    expect(lobbyDestination(context)).toBe(`/e/${event.code}/locked`);
    expect(contestDestination(context, { entered: true })).toBe(
      `/e/${event.code}/locked`,
    );

    // And a signal from that device writes nothing more.
    await expect(
      recordStrike(context, { kind: "focus_lost" }, {
        now: addMinutes(startsAt, 35),
      }),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
  });
});

describe("the five-second heartbeat", () => {
  it("reports state every five seconds", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(5_000);
    expect(
      heartbeatReport(null, "visible"),
    ).toEqual({ fullscreen: false, visibilityState: "visible" });
    expect(
      heartbeatReport({ tagName: "HTML" }, "hidden"),
    ).toEqual({ fullscreen: true, visibilityState: "hidden" });
  });

  it("names a violation only for the states SPEC §6 counts", () => {
    expect(
      violatingHeartbeatKinds({
        fullscreen: true,
        visibilityState: "visible",
        entered: true,
      }),
    ).toEqual([]);
    expect(
      violatingHeartbeatKinds({
        fullscreen: false,
        visibilityState: "visible",
        entered: true,
      }),
    ).toEqual(["fullscreen_exit"]);
    expect(
      violatingHeartbeatKinds({
        fullscreen: true,
        visibilityState: "hidden",
        entered: true,
      }),
    ).toEqual(["focus_lost"]);
    expect(
      violatingHeartbeatKinds({
        fullscreen: false,
        visibilityState: "hidden",
        entered: true,
      }),
    ).toEqual(["fullscreen_exit", "focus_lost"]);
  });

  it("does not treat a session that never crossed the gate as an exit", () => {
    expect(
      violatingHeartbeatKinds({
        fullscreen: false,
        visibilityState: "visible",
        entered: false,
      }),
    ).toEqual([]);
  });

  it("counts a violating heartbeat the client never reported", async () => {
    const { participant } = await contest("BEAT01");
    const at = addMinutes(startsAt, 31);
    const context = await contextAt("BEAT01", at);

    const outcome = await recordHeartbeat(
      context,
      { fullscreen: false, visibilityState: "visible", entered: true },
      { now: at },
    );

    expect(outcome).toMatchObject({ strikes: 1, eliminated: false, counted: 1 });
    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "fullscreen_exit",
      counted: true,
      createdAt: at,
    });
  });

  it("does not count a heartbeat for a violation the client just reported", async () => {
    const { participant } = await contest("BEAT02");
    const at = addMinutes(startsAt, 31);
    const context = await contextAt("BEAT02", at);

    // The client's `fullscreenchange` arrives, then the heartbeat that was
    // already in flight reports the same state.
    await recordStrike(context, { kind: "fullscreen_exit" }, { now: at });
    const outcome = await recordHeartbeat(
      context,
      { fullscreen: false, visibilityState: "visible", entered: true },
      { now: new Date(at.getTime() + 300) },
    );

    expect(outcome).toMatchObject({ strikes: 1, counted: 0, eliminated: false });
    expect(await loggedViolations(participant.id)).toHaveLength(1);
    expect((await participantRow(participant.id)).strikes).toBe(1);
  });

  it("counts one strike when both fullscreen and visibility are wrong", async () => {
    const { participant } = await contest("BEAT03");
    const at = addMinutes(startsAt, 31);
    const context = await contextAt("BEAT03", at);

    const outcome = await recordHeartbeat(
      context,
      { fullscreen: false, visibilityState: "hidden", entered: true },
      { now: at },
    );

    expect(outcome).toMatchObject({ strikes: 1, counted: 1, eliminated: false });
    expect(await loggedViolations(participant.id)).toHaveLength(1);
  });

  it("records nothing for a clean heartbeat", async () => {
    const { participant } = await contest("BEAT04");
    const at = addMinutes(startsAt, 31);
    const context = await contextAt("BEAT04", at);

    const outcome = await recordHeartbeat(
      context,
      { fullscreen: true, visibilityState: "visible", entered: true },
      { now: at },
    );

    expect(outcome).toMatchObject({ strikes: 0, counted: 0, eliminated: false });
    expect(await loggedViolations(participant.id)).toEqual([]);
    expect((await participantRow(participant.id)).strikes).toBe(0);
  });

  it("eliminates a participant who suppresses the page listeners entirely", async () => {
    const { participant } = await contest("BEAT05");
    const context = await contextAt("BEAT05", inContest);

    // No client event ever arrives. Only the heartbeat does, every five
    // seconds, each one still reporting the same violation.
    const beats = [0, 5_000, 10_000].map(
      (offset) => new Date(inContest.getTime() + offset),
    );
    const outcomes = [];
    for (const at of beats) {
      outcomes.push(
        await recordHeartbeat(
          context,
          { fullscreen: false, visibilityState: "visible", entered: true },
          { now: at },
        ),
      );
    }

    expect(outcomes.map((outcome) => outcome.strikes)).toEqual([1, 2, 3]);
    expect(outcomes.at(-1)?.eliminated).toBe(true);
    expect(await participantRow(participant.id)).toMatchObject({
      status: "locked_out",
      strikes: 3,
      lockoutReason: "eliminated",
      lockedAt: beats[2],
    });
    expect(
      await db.select().from(submissions).where(eq(submissions.participantId, participant.id)),
    ).toHaveLength(1);
  });
});

describe("the counter the participant always sees", () => {
  it("reads N of 3", () => {
    expect(renderToStaticMarkup(createElement(StrikeCounter, { strikes: 0 }))).toContain(
      "0 of 3",
    );
    expect(renderToStaticMarkup(createElement(StrikeCounter, { strikes: 2 }))).toContain(
      "2 of 3",
    );
  });

  it("is rendered in the contest header", () => {
    const source = readFileSync(
      resolve(__dirname, "../src/components/contest-workspace.tsx"),
      "utf8",
    );
    expect(source).toContain("<StrikeCounter");
  });
});
