import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { joinEventByCode } from "@/lib/participants/join";
import { loadParticipantContext } from "@/lib/participants/queries";
import {
  contestDestination,
  lobbyDestination,
} from "@/lib/participants/routes";
import { participants } from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { db, useCleanDatabase } from "./helpers/db";
import {
  insertEvent,
  insertParticipant,
  testUser,
} from "./helpers/factories";

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

const organizer = testUser({ email: "organizer@example.com" });
const solver = testUser({ email: "solver@example.com", name: "Sam Solver" });

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

async function countParticipants(eventId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participants)
    .where(eq(participants.eventId, eventId));
  return row.count;
}

describe("join by code", () => {
  it("creates exactly one participant row on the first join", async () => {
    const event = await insertEvent({ code: "JOIN01" });

    const result = await joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code: "join01",
    });

    expect(result.eventCode).toBe("JOIN01");
    expect(result.eventStatus).toBe("draft");
    expect(await countParticipants(event.id)).toBe(1);

    const context = await loadParticipantContext("JOIN01", solver.id);
    expect(context?.participant?.displayName).toBe("Sam Solver");
    expect(context?.participant?.email).toBe("solver@example.com");
  });

  it("returns the existing entry when the same code is entered again", async () => {
    const event = await insertEvent({ code: "AGAIN1" });

    const first = await joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code: "AGAIN1",
    });
    const second = await joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code: "again1",
    });

    expect(second.participantId).toBe(first.participantId);
    expect(await countParticipants(event.id)).toBe(1);
  });

  it("keeps the name and email captured at the first join", async () => {
    await insertEvent({ code: "FIRST1" });

    await joinEventByCode({
      userId: solver.id,
      displayName: "Sam Solver",
      email: solver.email,
      code: "FIRST1",
    });
    await joinEventByCode({
      userId: solver.id,
      displayName: "Renamed Later",
      email: "renamed@example.com",
      code: "FIRST1",
    });

    const context = await loadParticipantContext("FIRST1", solver.id);
    expect(context?.participant?.displayName).toBe("Sam Solver");
    expect(context?.participant?.email).toBe("solver@example.com");
  });

  it("refuses a code that matches no event", async () => {
    await expect(
      joinEventByCode({
        userId: solver.id,
        displayName: solver.name,
        email: solver.email,
        code: "NOPE99",
      }),
    ).rejects.toMatchObject({ code: "join_code_unknown" });
  });

  it("refuses the code of an ended event", async () => {
    await insertEvent({ code: "OVER99", status: "ended" });

    await expect(
      joinEventByCode({
        userId: solver.id,
        displayName: solver.name,
        email: solver.email,
        code: "OVER99",
      }),
    ).rejects.toMatchObject({ code: "join_code_ended" });
  });

  it("refuses an organizer, including on an event they created", async () => {
    await insertEvent({ code: "OWN999", createdBy: organizer.id });

    await expect(
      joinEventByCode({
        userId: organizer.id,
        displayName: organizer.name,
        email: organizer.email,
        code: "OWN999",
      }),
    ).rejects.toMatchObject({
      code: "organizer_cannot_join",
      message: expect.stringContaining("Organizers cannot join"),
    });
  });
});

describe("lobby routing", () => {
  const startsAt = new Date("2026-10-28T18:00:00.000Z");
  const deadlineAt = addMinutes(startsAt, 90);

  async function joinLive(code: string) {
    await insertEvent({
      code,
      status: "live",
      startsAt,
      deadlineAt,
    });
    return joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code,
    });
  }

  it("accepts a participant who joins while the event is live", async () => {
    const result = await joinLive("LIVE01");

    expect(result.eventStatus).toBe("live");

    const context = await loadParticipantContext("LIVE01", solver.id, {
      now: startsAt,
    });
    expect(context?.participant?.id).toBe(result.participantId);
    expect(context?.participant?.status).toBe("joined");
  });

  it("sends a participant re-entering a live event straight to the contest", async () => {
    await joinLive("LIVE02");

    const context = await loadParticipantContext("LIVE02", solver.id, {
      now: addMinutes(startsAt, 30),
    });
    expect(lobbyDestination(context)).toBe("/e/LIVE02/contest");
  });

  it("keeps a draft event in the lobby", async () => {
    await insertEvent({ code: "DRAFT1" });
    await joinEventByCode({
      userId: solver.id,
      displayName: solver.name,
      email: solver.email,
      code: "DRAFT1",
    });

    const context = await loadParticipantContext("DRAFT1", solver.id);
    expect(lobbyDestination(context)).toBeNull();
  });

  it("sends a viewer with no entry for the event back to join", async () => {
    await insertEvent({ code: "NOENT1" });

    const context = await loadParticipantContext("NOENT1", solver.id);
    expect(context?.participant).toBeNull();
    expect(lobbyDestination(context)).toBe("/join");
  });

  it("sends an unknown code back to join", async () => {
    const context = await loadParticipantContext("GONE99", solver.id);
    expect(lobbyDestination(context)).toBe("/join");
  });

  it("does not prorate the deadline for a late joiner", async () => {
    await joinLive("LATE01");

    const context = await loadParticipantContext("LATE01", solver.id, {
      now: addMinutes(startsAt, 60),
    });
    expect(context?.event.deadlineAt?.toISOString()).toBe(
      deadlineAt.toISOString(),
    );
    expect(context?.participant?.status).toBe("joined");
  });

  it("locks a participant who reads the event after the deadline", async () => {
    await joinLive("LATE02");

    const context = await loadParticipantContext("LATE02", solver.id, {
      now: addMinutes(deadlineAt, 5),
    });
    expect(context?.participant?.status).toBe("locked_out");
    expect(context?.participant?.lockoutReason).toBe("deadline");
    expect(context?.participant?.lockedAt?.toISOString()).toBe(
      deadlineAt.toISOString(),
    );
    expect(lobbyDestination(context)).toBe("/e/LATE02/locked");
  });

  it("locks at the deadline itself, not one millisecond later", async () => {
    await joinLive("LATE03");

    const context = await loadParticipantContext("LATE03", solver.id, {
      now: deadlineAt,
    });
    expect(context?.participant?.lockoutReason).toBe("deadline");
    expect(context?.participant?.lockedAt?.toISOString()).toBe(
      deadlineAt.toISOString(),
    );
  });

  it("leaves an already locked participant's reason alone", async () => {
    const event = await insertEvent({
      code: "SUBM01",
      status: "live",
      startsAt,
      deadlineAt,
    });
    const submittedAt = addMinutes(startsAt, 20);
    await insertParticipant(event.id, solver, {
      status: "locked_out",
      lockoutReason: "submitted",
      lockedAt: submittedAt,
    });

    const context = await loadParticipantContext("SUBM01", solver.id, {
      now: addMinutes(deadlineAt, 5),
    });
    expect(context?.participant?.lockoutReason).toBe("submitted");
    expect(context?.participant?.lockedAt?.toISOString()).toBe(
      submittedAt.toISOString(),
    );
    expect(lobbyDestination(context)).toBe("/e/SUBM01/locked");
  });
});

describe("contest gate", () => {
  const startsAt = new Date("2026-10-28T18:00:00.000Z");
  const deadlineAt = addMinutes(startsAt, 90);

  it("stays in the contest while the event is live and the participant is unlocked", async () => {
    const event = await insertEvent({
      code: "CONST1",
      status: "live",
      startsAt,
      deadlineAt,
    });
    await insertParticipant(event.id, solver);

    const context = await loadParticipantContext("CONST1", solver.id, {
      now: addMinutes(startsAt, 10),
    });
    expect(contestDestination(context)).toBeNull();
  });

  it("returns a draft event to the lobby", async () => {
    const event = await insertEvent({ code: "CONST2" });
    await insertParticipant(event.id, solver);

    const context = await loadParticipantContext("CONST2", solver.id);
    expect(contestDestination(context)).toBe("/e/CONST2");
  });

  it("sends a locked participant to the terminal screen", async () => {
    const event = await insertEvent({
      code: "CONST3",
      status: "live",
      startsAt,
      deadlineAt,
    });
    await insertParticipant(event.id, solver);

    const context = await loadParticipantContext("CONST3", solver.id, {
      now: addMinutes(deadlineAt, 1),
    });
    expect(contestDestination(context)).toBe("/e/CONST3/locked");
  });

  it("sends a viewer with no entry to join", async () => {
    await insertEvent({ code: "CONST4", status: "live", startsAt, deadlineAt });

    const context = await loadParticipantContext("CONST4", solver.id, {
      now: startsAt,
    });
    expect(contestDestination(context)).toBe("/join");
  });

  it("sends an ended event to the terminal screen", async () => {
    const event = await insertEvent({ code: "CONST5", status: "ended" });
    await insertParticipant(event.id, solver);

    const context = await loadParticipantContext("CONST5", solver.id);
    expect(contestDestination(context)).toBe("/e/CONST5/locked");
  });
});
