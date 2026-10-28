import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { drafts, participants } from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { loadParticipantContext } from "@/lib/participants/queries";
import {
  contestDestination,
  lobbyDestination,
} from "@/lib/participants/routes";
import { markSolving } from "@/lib/participants/lockout";
import {
  GATE_TTL_MS,
  gateCookieName,
  isGateTokenValid,
  signGateToken,
} from "@/lib/participants/gate-token";
import { chooseDraft, draftKey } from "@/lib/drafts/merge";
import { listDrafts, saveDraft } from "@/lib/drafts/manage";
import {
  anchorClock,
  projectNow,
  projectRemainingSeconds,
} from "@/lib/contest/clock";
import { db, useCleanDatabase } from "./helpers/db";
import {
  insertEvent,
  insertParticipant,
  insertProblem,
  insertStarter,
  testUser,
} from "./helpers/factories";

useCleanDatabase();

const solver = testUser({ email: "solver@example.com", name: "Sam Solver" });
const startsAt = new Date("2026-10-28T18:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);
const secret = "test-gate-secret";

async function liveEvent(code: string) {
  const event = await insertEvent({
    code,
    status: "live",
    startsAt,
    deadlineAt,
    durationMinutes: 90,
  });
  const participant = await insertParticipant(event.id, solver);
  return { event, participant };
}

describe("enter gate token", () => {
  const claims = {
    eventId: "11111111-1111-4111-8111-111111111111",
    participantId: "22222222-2222-4222-8222-222222222222",
    expiresAtMs: startsAt.getTime() + GATE_TTL_MS,
  };

  it("names the cookie after the event code", () => {
    expect(gateCookieName("abc123")).toBe("cf_gate_ABC123");
    expect(gateCookieName(" LIVE02 ")).toBe("cf_gate_LIVE02");
  });

  it("accepts a token it signed for the same participant and event", () => {
    const token = signGateToken(claims, secret);

    expect(
      isGateTokenValid(token, {
        eventId: claims.eventId,
        participantId: claims.participantId,
        now: startsAt,
        secret,
      }),
    ).toBe(true);
  });

  it("refuses a token after it expires", () => {
    const token = signGateToken(claims, secret);
    const after = new Date(claims.expiresAtMs + 1);

    expect(
      isGateTokenValid(token, {
        eventId: claims.eventId,
        participantId: claims.participantId,
        now: after,
        secret,
      }),
    ).toBe(false);
  });

  it("refuses a token minted for another participant or event", () => {
    const token = signGateToken(claims, secret);

    expect(
      isGateTokenValid(token, {
        eventId: claims.eventId,
        participantId: "33333333-3333-4333-8333-333333333333",
        now: startsAt,
        secret,
      }),
    ).toBe(false);
    expect(
      isGateTokenValid(token, {
        eventId: "44444444-4444-4444-8444-444444444444",
        participantId: claims.participantId,
        now: startsAt,
        secret,
      }),
    ).toBe(false);
  });

  it("refuses a tampered token, a missing one, and one signed with another secret", () => {
    const token = signGateToken(claims, secret);
    const [eventId, participantId, expires, signature] = token.split(".");
    const tampered = [eventId, participantId, String(Number(expires) + 60_000), signature].join(".");

    expect(
      isGateTokenValid(tampered, {
        eventId: claims.eventId,
        participantId: claims.participantId,
        now: startsAt,
        secret,
      }),
    ).toBe(false);
    expect(
      isGateTokenValid(undefined, {
        eventId: claims.eventId,
        participantId: claims.participantId,
        now: startsAt,
        secret,
      }),
    ).toBe(false);
    expect(
      isGateTokenValid(signGateToken(claims, "other-secret"), {
        eventId: claims.eventId,
        participantId: claims.participantId,
        now: startsAt,
        secret,
      }),
    ).toBe(false);
  });
});

describe("contest gate routing", () => {
  it("keeps an ungated live participant on the lobby gate", async () => {
    const { event } = await liveEvent("GATE01");
    const context = await loadParticipantContext("GATE01", solver.id, {
      now: addMinutes(startsAt, 10),
    });

    expect(contestDestination(context, { entered: false })).toBe("/e/GATE01");
    expect(lobbyDestination(context, { entered: false })).toBeNull();
    expect(event.code).toBe("GATE01");
  });

  it("lets an entered live participant into the contest", async () => {
    await liveEvent("GATE02");
    const context = await loadParticipantContext("GATE02", solver.id, {
      now: addMinutes(startsAt, 10),
    });

    expect(contestDestination(context, { entered: true })).toBeNull();
    expect(lobbyDestination(context, { entered: true })).toBe(
      "/e/GATE02/contest",
    );
  });

  it("still refuses a missing gate token for a live participant who typed the URL", async () => {
    await liveEvent("GATE03");
    const context = await loadParticipantContext("GATE03", solver.id, {
      now: addMinutes(startsAt, 10),
    });

    // The gate decision is the server's, not client state: without the
    // token the contest route is not reachable.
    expect(contestDestination(context, { entered: false })).not.toBeNull();
    expect(contestDestination(context, { entered: false })).toBe("/e/GATE03");
  });

  it("sends a draft event back to the lobby even with a token", async () => {
    const event = await insertEvent({ code: "GATE04" });
    await insertParticipant(event.id, solver);
    const context = await loadParticipantContext("GATE04", solver.id);

    expect(contestDestination(context, { entered: true })).toBe("/e/GATE04");
    expect(lobbyDestination(context, { entered: true })).toBeNull();
  });

  it("sends a locked participant to the terminal screen, token or not", async () => {
    await liveEvent("GATE05");
    const context = await loadParticipantContext("GATE05", solver.id, {
      now: addMinutes(deadlineAt, 1),
    });

    expect(contestDestination(context, { entered: true })).toBe(
      "/e/GATE05/locked",
    );
    expect(contestDestination(context, { entered: false })).toBe(
      "/e/GATE05/locked",
    );
    expect(lobbyDestination(context, { entered: false })).toBe(
      "/e/GATE05/locked",
    );
  });

  it("sends a viewer with no entry to join, gate or not", async () => {
    await insertEvent({ code: "GATE06", status: "live", startsAt, deadlineAt });
    const context = await loadParticipantContext("GATE06", solver.id, {
      now: startsAt,
    });

    expect(contestDestination(context, { entered: true })).toBe("/join");
    expect(lobbyDestination(context, { entered: false })).toBe("/join");
  });
});

describe("entering the contest", () => {
  it("marks a joined participant as solving", async () => {
    const { participant } = await liveEvent("SOLV01");

    const updated = await markSolving(participant.id, startsAt);

    expect(updated?.status).toBe("solving");
  });

  it("is idempotent and never reopens a locked participant", async () => {
    const { participant } = await liveEvent("SOLV02");

    await markSolving(participant.id, startsAt);
    await markSolving(participant.id, startsAt);
    const [row] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, participant.id));
    expect(row.status).toBe("solving");

    await db
      .update(participants)
      .set({ status: "locked_out", lockoutReason: "deadline", lockedAt: deadlineAt })
      .where(eq(participants.id, participant.id));

    const after = await markSolving(participant.id, addMinutes(deadlineAt, 1));
    expect(after).toBeNull();
    const [locked] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, participant.id));
    expect(locked.status).toBe("locked_out");
  });
});

describe("drafts", () => {
  async function contestSetup(code: string) {
    const { event, participant } = await liveEvent(code);
    const problem = await insertProblem(event.id, { position: 1 });
    await insertStarter(problem.id, "python", "def two_sum(nums, target):\n");
    const context = await loadParticipantContext(code, solver.id, {
      now: addMinutes(startsAt, 5),
    });
    return { event, participant, problem, context };
  }

  it("saves per problem per language and reads them back", async () => {
    const { problem, context } = await contestSetup("DRFT01");

    await saveDraft(context, {
      problemId: problem.id,
      language: "python",
      code: "print('python')\n",
    }, { now: addMinutes(startsAt, 6) });
    await saveDraft(context, {
      problemId: problem.id,
      language: "java",
      code: "class Main {}\n",
    }, { now: addMinutes(startsAt, 7) });

    const saved = await listDrafts(context);
    expect(
      saved.map((draft) => [draft.language, draft.code]).sort(),
    ).toEqual([
      ["java", "class Main {}\n"],
      ["python", "print('python')\n"],
    ]);
  });

  it("updates one row instead of accumulating drafts", async () => {
    const { problem, context } = await contestSetup("DRFT02");
    const firstAt = addMinutes(startsAt, 6);
    const secondAt = addMinutes(startsAt, 9);

    const first = await saveDraft(
      context,
      { problemId: problem.id, language: "python", code: "first\n" },
      { now: firstAt },
    );
    const second = await saveDraft(
      context,
      { problemId: problem.id, language: "python", code: "second\n" },
      { now: secondAt },
    );

    expect(second.updatedAt.getTime()).toBeGreaterThan(
      first.updatedAt.getTime(),
    );

    const rows = await db
      .select()
      .from(drafts)
      .where(eq(drafts.problemId, problem.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe("second\n");

    // A refresh reads the latest code back, not the seed.
    const reloaded = await loadParticipantContext("DRFT02", solver.id, {
      now: addMinutes(startsAt, 10),
    });
    const draftsAfterRefresh = await listDrafts(reloaded);
    expect(draftsAfterRefresh[0].code).toBe("second\n");
  });

  it("refuses a save before the event is live", async () => {
    const event = await insertEvent({ code: "DRFT03" });
    await insertParticipant(event.id, solver);
    const problem = await insertProblem(event.id);
    const context = await loadParticipantContext("DRFT03", solver.id);

    await expect(
      saveDraft(context, {
        problemId: problem.id,
        language: "python",
        code: "x",
      }),
    ).rejects.toMatchObject({ code: "contest_not_open" });
  });

  it("refuses a save once the deadline has locked the participant", async () => {
    const { problem } = await contestSetup("DRFT04");
    const locked = await loadParticipantContext("DRFT04", solver.id, {
      now: addMinutes(deadlineAt, 1),
    });
    expect(locked?.participant?.status).toBe("locked_out");

    await expect(
      saveDraft(locked, {
        problemId: problem.id,
        language: "python",
        code: "late\n",
      }),
    ).rejects.toMatchObject({ code: "contest_locked" });
  });

  it("refuses a problem from another event", async () => {
    const { context } = await contestSetup("DRFT05");
    const otherEvent = await insertEvent({ code: "DRFT06" });
    const otherProblem = await insertProblem(otherEvent.id);

    await expect(
      saveDraft(context, {
        problemId: otherProblem.id,
        language: "python",
        code: "x",
      }),
    ).rejects.toMatchObject({ code: "problem_not_found" });
  });

  it("shows nothing to a viewer without a participant row", async () => {
    await expect(listDrafts(null)).resolves.toEqual([]);
  });
});

describe("local versus server draft", () => {
  it("prefers the newer server copy and asks for no resync", () => {
    const choice = chooseDraft(
      { code: "server\n", updatedAt: 2_000 },
      { code: "local\n", updatedAt: 1_000 },
      "starter\n",
    );

    expect(choice).toEqual({
      code: "server\n",
      updatedAt: 2_000,
      source: "server",
      pendingSave: false,
    });
  });

  it("prefers the newer local copy and marks it for resync", () => {
    const choice = chooseDraft(
      { code: "server\n", updatedAt: 1_000 },
      { code: "local\n", updatedAt: 2_000 },
      "starter\n",
    );

    expect(choice).toEqual({
      code: "local\n",
      updatedAt: 2_000,
      source: "local",
      pendingSave: true,
    });
  });

  it("treats an equal timestamp as already saved on the server", () => {
    const choice = chooseDraft(
      { code: "server\n", updatedAt: 5_000 },
      { code: "local\n", updatedAt: 5_000 },
      "starter\n",
    );

    expect(choice.source).toBe("server");
    expect(choice.code).toBe("server\n");
    expect(choice.pendingSave).toBe(false);
  });

  it("keeps a local copy the server never received", () => {
    const choice = chooseDraft(
      null,
      { code: "only local\n", updatedAt: 5_000 },
      "starter\n",
    );

    expect(choice).toMatchObject({
      code: "only local\n",
      source: "local",
      pendingSave: true,
    });
  });

  it("seeds from Starter Code when neither copy exists, without saving it", () => {
    const choice = chooseDraft(null, null, "def two_sum(nums, target):\n");

    expect(choice).toEqual({
      code: "def two_sum(nums, target):\n",
      updatedAt: 0,
      source: "starter",
      pendingSave: false,
    });
  });

  it("uses an empty buffer when the language has no Starter Code", () => {
    expect(chooseDraft(null, null, undefined)).toMatchObject({
      code: "",
      source: "starter",
    });
  });

  it("keys drafts by problem and language", () => {
    expect(draftKey("problem-1", "python")).toBe("problem-1:python");
    expect(draftKey("problem-1", "java")).not.toBe(
      draftKey("problem-1", "python"),
    );
  });
});

describe("countdown projection", () => {
  const serverNow = new Date("2026-10-28T18:00:00.000Z");

  it("projects from the server anchor plus monotonic elapsed time", () => {
    const anchor = anchorClock(serverNow, 1_000);

    expect(projectNow(anchor, 66_000)).toBe(serverNow.getTime() + 65_000);
    expect(
      projectRemainingSeconds(
        new Date(serverNow.getTime() + 90 * 60_000),
        projectNow(anchor, 66_000),
      ),
    ).toBe(90 * 60 - 65);
  });

  it("re-derives from a fresh anchor on every poll", () => {
    const first = anchorClock(serverNow, 1_000);
    const polled = new Date(serverNow.getTime() + 10_000);
    const second = anchorClock(polled, 11_000);

    expect(projectNow(first, 6_000)).toBe(serverNow.getTime() + 5_000);
    expect(projectNow(second, 6_000)).toBe(polled.getTime() - 5_000);
  });

  it("ignores a tampered local wall clock", () => {
    const anchor = anchorClock(serverNow, 1_000);
    const spy = vi.spyOn(Date, "now").mockReturnValue(0);

    expect(projectNow(anchor, 61_000)).toBe(serverNow.getTime() + 60_000);
    expect(
      projectRemainingSeconds(
        new Date(serverNow.getTime() + 90 * 60_000),
        projectNow(anchor, 61_000),
      ),
    ).toBe(90 * 60 - 60);

    spy.mockRestore();
  });

  it("never reports negative time and reports null with no deadline", () => {
    expect(
      projectRemainingSeconds(
        new Date(serverNow.getTime() + 5_000),
        serverNow.getTime() + 6_000,
      ),
    ).toBe(0);
    expect(projectRemainingSeconds(null, serverNow.getTime())).toBeNull();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
