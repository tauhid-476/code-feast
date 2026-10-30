import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/app/admin/events/[id]/live/actions", () => ({
  startEventAction: vi.fn(),
  extendDeadlineAction: vi.fn(),
  endEventAction: vi.fn(),
  reinstateParticipantAction: vi.fn(),
}));

import {
  events,
  participants,
  submissionSnippets,
  submissions,
} from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { endEvent, extendDeadline } from "@/lib/events/clock";
import { getEventHealth } from "@/lib/events/live";
import { saveDraft } from "@/lib/drafts/manage";
import { recordStrike } from "@/lib/violations/strikes";
import { reinstateParticipant } from "@/lib/participants/lockout";
import { loadParticipantContext } from "@/lib/participants/queries";
import { EliminatedParticipantsCard } from "@/components/eliminated-participants";
import { EventClockControls } from "@/components/event-clock-controls";
import { db, useCleanDatabase } from "./helpers/db";
import {
  insertEvent,
  insertParticipant,
  insertProblem,
  testUser,
} from "./helpers/factories";

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

const organizer = testUser({ email: "organizer@example.com" });
const actor = { id: organizer.id, email: organizer.email };
const solver1 = testUser({ email: "solver1@example.com", name: "Alice Solver" });
const solver2 = testUser({ email: "solver2@example.com", name: "Bob Solver" });
const solver3 = testUser({ email: "solver3@example.com", name: "Charlie Solver" });

const startsAt = new Date("2026-10-28T18:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("Ticket 15: Reinstate and deadline reopen", () => {
  describe("reinstateParticipant", () => {
    it("clears strikes, resets lockoutReason, and returns the participant to solving", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REINST01",
        status: "live",
        startsAt,
        deadlineAt,
        durationMinutes: 90,
      });

      const participant = await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 3,
        lockedAt: addMinutes(startsAt, 30),
      });

      const now = addMinutes(startsAt, 35);
      const reinstated = await reinstateParticipant(
        actor,
        event.id,
        participant.id,
        { now },
      );

      expect(reinstated.status).toBe("solving");
      expect(reinstated.strikes).toBe(0);
      expect(reinstated.lockoutReason).toBeNull();
      expect(reinstated.lockedAt).toBeNull();
      expect(reinstated.activeSessionId).toBeNull();

      // Verify row in DB
      const [row] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, participant.id));
      expect(row.status).toBe("solving");
      expect(row.strikes).toBe(0);
      expect(row.lockoutReason).toBeNull();
      expect(row.lockedAt).toBeNull();
    });

    it("keeps the original deadline with no time refunded", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REINST02",
        status: "live",
        startsAt,
        deadlineAt,
        durationMinutes: 90,
      });

      const participant = await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 3,
        lockedAt: addMinutes(startsAt, 20),
      });

      // 40 minutes into contest, reinstated
      const reinstateTime = addMinutes(startsAt, 40);
      await reinstateParticipant(actor, event.id, participant.id, {
        now: reinstateTime,
      });

      // The event's deadline remains unchanged
      const [eventRow] = await db
        .select()
        .from(events)
        .where(eq(events.id, event.id));
      expect(eventRow.deadlineAt?.toISOString()).toBe(deadlineAt.toISOString());

      // Context read by participant sees original deadline
      const ctx = await loadParticipantContext(event.code, solver1.id, {
        now: reinstateTime,
      });
      expect(ctx?.event.deadlineAt?.toISOString()).toBe(deadlineAt.toISOString());
      expect(ctx?.participant?.status).toBe("solving");
    });

    it("preserves existing drafts and the frozen Submission produced at elimination", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REINST03",
        status: "live",
        startsAt,
        deadlineAt,
        durationMinutes: 90,
      });

      const problem = await insertProblem(event.id, {
        position: 1,
        title: "Two Sum",
      });

      const participant = await insertParticipant(event.id, solver1, {
        status: "solving",
      });

      const ctxBefore = await loadParticipantContext(event.code, solver1.id, {
        now: addMinutes(startsAt, 10),
      });

      // Save a draft
      await saveDraft(
        ctxBefore,
        {
          problemId: problem.id,
          language: "python",
          code: "def solve():\n    return 42\n",
        },
        { now: addMinutes(startsAt, 15) },
      );

      // Eliminate the participant with 3 strikes
      await recordStrike(ctxBefore, { kind: "focus_lost" }, { now: addMinutes(startsAt, 16) });
      await recordStrike(ctxBefore, { kind: "focus_lost" }, { now: addMinutes(startsAt, 19) });
      const third = await recordStrike(
        ctxBefore,
        { kind: "focus_lost" },
        { now: addMinutes(startsAt, 22) },
      );
      expect(third.eliminated).toBe(true);

      // Verify submission exists
      const [submissionBefore] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.participantId, participant.id));
      expect(submissionBefore).toBeDefined();
      expect(submissionBefore.reason).toBe("eliminated");

      const [snippetBefore] = await db
        .select()
        .from(submissionSnippets)
        .where(eq(submissionSnippets.submissionId, submissionBefore.id));
      expect(snippetBefore.code).toBe("def solve():\n    return 42\n");

      // Reinstate participant
      await reinstateParticipant(actor, event.id, participant.id, {
        now: addMinutes(startsAt, 25),
      });

      // Existing drafts and frozen submission remain
      const [submissionAfter] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.participantId, participant.id));
      expect(submissionAfter.id).toBe(submissionBefore.id);
      expect(submissionAfter.reason).toBe("eliminated");

      const [snippetAfter] = await db
        .select()
        .from(submissionSnippets)
        .where(eq(submissionSnippets.submissionId, submissionAfter.id));
      expect(snippetAfter.code).toBe("def solve():\n    return 42\n");

      // Participant resumes where they left off with drafts intact
      const ctxAfter = await loadParticipantContext(event.code, solver1.id, {
        now: addMinutes(startsAt, 26),
      });
      expect(ctxAfter?.participant?.status).toBe("solving");

      // Can continue saving drafts
      await saveDraft(
        ctxAfter,
        {
          problemId: problem.id,
          language: "python",
          code: "def solve():\n    return 100\n",
        },
        { now: addMinutes(startsAt, 27) },
      );
    });

    it("is disabled once the event has ended, throwing event_ended 409", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REINST04",
        status: "ended",
        startsAt,
        deadlineAt,
        endedAt: addMinutes(startsAt, 90),
      });

      const participant = await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 3,
      });

      // Refuses because event status is ended
      await expect(
        reinstateParticipant(actor, event.id, participant.id),
      ).rejects.toMatchObject({
        code: "event_ended",
        status: 409,
      });

      // Also refuses if event status is live but deadline has passed
      const liveEvent = await insertEvent({
        createdBy: organizer.id,
        code: "REINST05",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const participant2 = await insertParticipant(liveEvent.id, solver2, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 3,
      });

      await expect(
        reinstateParticipant(actor, liveEvent.id, participant2.id, {
          now: addMinutes(deadlineAt, 1),
        }),
      ).rejects.toMatchObject({
        code: "event_ended",
        status: 409,
      });
    });

    it("refuses to reinstate a participant who was not eliminated", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REINST06",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const submitted = await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "submitted",
      });

      await expect(
        reinstateParticipant(actor, event.id, submitted.id, {
          now: addMinutes(startsAt, 30),
        }),
      ).rejects.toMatchObject({
        code: "participant_not_eliminated",
        status: 400,
      });

      const solving = await insertParticipant(event.id, solver2, {
        status: "solving",
      });

      await expect(
        reinstateParticipant(actor, event.id, solving.id, {
          now: addMinutes(startsAt, 30),
        }),
      ).rejects.toMatchObject({
        code: "participant_not_eliminated",
        status: 400,
      });
    });

    it("requires the organizer role to reinstate", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REINST07",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const participant = await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 3,
      });

      const nonOrganizerActor = { id: solver2.id, email: solver2.email };

      await expect(
        reinstateParticipant(nonOrganizerActor, event.id, participant.id),
      ).rejects.toMatchObject({
        code: "not_organizer",
        status: 403,
      });
    });
  });

  describe("extendDeadline and reopening deadline lockouts", () => {
    it("extends an event that ended by reaching deadline and reopens exactly deadline-locked participants", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "EXTEND01",
        status: "live",
        startsAt,
        deadlineAt,
      });

      // Participant 1: locked by deadline
      const pDeadline = await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "deadline",
        lockedAt: deadlineAt,
      });

      // Participant 2: locked by submitted
      const pSubmitted = await insertParticipant(event.id, solver2, {
        status: "locked_out",
        lockoutReason: "submitted",
        lockedAt: addMinutes(startsAt, 45),
      });

      // Participant 3: locked by eliminated
      const pEliminated = await insertParticipant(event.id, solver3, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 3,
        lockedAt: addMinutes(startsAt, 50),
      });

      // Extend deadline by 10 minutes from expectedDeadlineAt = deadlineAt
      const result = await extendDeadline(actor, event.id, {
        expectedDeadlineAt: deadlineAt,
      });

      expect(result.changed).toBe(true);
      expect(result.event.status).toBe("live");
      expect(result.event.deadlineAt?.toISOString()).toBe(
        addMinutes(deadlineAt, 10).toISOString(),
      );

      // Participant 1 (deadline): reopened to solving
      const [p1Row] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, pDeadline.id));
      expect(p1Row.status).toBe("solving");
      expect(p1Row.lockoutReason).toBeNull();
      expect(p1Row.lockedAt).toBeNull();

      // Participant 2 (submitted): remains locked
      const [p2Row] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, pSubmitted.id));
      expect(p2Row.status).toBe("locked_out");
      expect(p2Row.lockoutReason).toBe("submitted");
      expect(p2Row.lockedAt).toBeDefined();

      // Participant 3 (eliminated): remains locked
      const [p3Row] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, pEliminated.id));
      expect(p3Row.status).toBe("locked_out");
      expect(p3Row.lockoutReason).toBe("eliminated");
      expect(p3Row.strikes).toBe(3);
    });

    it("refuses to extend an event that the organizer ended manually", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "EXTEND02",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const manualEndTime = addMinutes(startsAt, 50);
      await endEvent(actor, event.id, { now: manualEndTime });

      const [endedEvent] = await db
        .select()
        .from(events)
        .where(eq(events.id, event.id));
      expect(endedEvent.status).toBe("ended");
      expect(endedEvent.endedAt).toBeDefined();

      // Attempting to extend is refused with event_ended_manually 409
      await expect(
        extendDeadline(actor, event.id, {
          expectedDeadlineAt: manualEndTime,
        }),
      ).rejects.toMatchObject({
        code: "event_not_live",
        status: 409,
      });
    });

    it("a reopened participant returns to solving with the new deadline and their autosaved code intact", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "EXTEND03",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const problem = await insertProblem(event.id, {
        position: 1,
        title: "Fibonacci",
      });

      const participant = await insertParticipant(event.id, solver1, {
        status: "solving",
      });

      // Participant saved draft before deadline
      const ctxBefore = await loadParticipantContext(event.code, solver1.id, {
        now: addMinutes(startsAt, 60),
      });
      await saveDraft(
        ctxBefore,
        {
          problemId: problem.id,
          language: "python",
          code: "def fib(n): return n",
        },
        { now: addMinutes(startsAt, 60) },
      );

      // Lock participant at deadline
      await loadParticipantContext(event.code, solver1.id, {
        now: addMinutes(deadlineAt, 1),
      });

      const [pLocked] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, participant.id));
      expect(pLocked.status).toBe("locked_out");
      expect(pLocked.lockoutReason).toBe("deadline");

      // Organizer extends deadline
      await extendDeadline(actor, event.id, {
        expectedDeadlineAt: deadlineAt,
      });

      // Participant checks in with new time: solving again with new deadline
      const ctxReopened = await loadParticipantContext(event.code, solver1.id, {
        now: addMinutes(deadlineAt, 2),
      });

      expect(ctxReopened?.participant?.status).toBe("solving");
      expect(ctxReopened?.participant?.lockoutReason).toBeNull();
      expect(ctxReopened?.event.deadlineAt?.toISOString()).toBe(
        addMinutes(deadlineAt, 10).toISOString(),
      );

      // The draft saved earlier is still intact
      const [draftRow] = await db
        .select()
        .from(submissionSnippets)
        .where(eq(submissionSnippets.problemId, problem.id));
      expect(draftRow.code).toBe("def fib(n): return n");
    });
  });

  describe("UI components and live view integration", () => {
    it("getEventHealth includes eliminated participants in live view", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "HEALTH01",
        status: "live",
        startsAt,
        deadlineAt,
      });

      await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 3,
        lockedAt: addMinutes(startsAt, 20),
      });

      await insertParticipant(event.id, solver2, {
        status: "solving",
      });

      const view = await getEventHealth(organizer.id, event.id, {
        now: addMinutes(startsAt, 30),
      });

      expect(view?.eliminated).toHaveLength(1);
      expect(view?.eliminated[0].displayName).toBe("Alice Solver");
      expect(view?.eliminated[0].strikes).toBe(3);
    });

    it("EliminatedParticipantsCard renders eliminated participants and disables Reinstate when event ended", () => {
      const p = {
        id: "p1",
        eventId: "e1",
        userId: "u1",
        displayName: "Alice Solver",
        email: "alice@example.com",
        status: "locked_out" as const,
        joinedAt: new Date(),
        lockedAt: new Date("2026-10-28T18:30:00.000Z"),
        lockoutReason: "eliminated" as const,
        strikes: 3,
        shortlisted: false,
        activeSessionId: null,
      };

      // Live event: Reinstate button is active
      const liveHtml = renderToStaticMarkup(
        createElement(EliminatedParticipantsCard, {
          eventId: "e1",
          eliminated: [p],
          eventEnded: false,
        }),
      );
      expect(liveHtml).toContain("Alice Solver");
      expect(liveHtml).toContain("3 strikes");
      expect(liveHtml).toContain("Reinstate");
      expect(liveHtml).not.toContain("disabled=\"\"");

      // Ended event: Reinstate button is disabled and displays explanation
      const endedHtml = renderToStaticMarkup(
        createElement(EliminatedParticipantsCard, {
          eventId: "e1",
          eliminated: [p],
          eventEnded: true,
        }),
      );
      expect(endedHtml).toContain("Alice Solver");
      expect(endedHtml).toContain("disabled=\"\"");
      expect(endedHtml).toContain("Reinstatement is disabled once the event has ended.");
    });

    it("EventClockControls displays ended manually message or allows Extend +10 when ended by deadline", () => {
      // Ended manually
      const endedManuallyHtml = renderToStaticMarkup(
        createElement(EventClockControls, {
          eventId: "e1",
          status: "ended",
          participants: 5,
          durationMinutes: 90,
          deadlineAt: "2026-10-28T19:30:00.000Z",
          endedAt: "2026-10-28T19:00:00.000Z",
        }),
      );
      expect(endedManuallyHtml).toContain("This event was ended manually by the organizer. It cannot be extended.");
      expect(endedManuallyHtml).not.toContain("Extend +10");

      // Ended at deadline
      const endedAtDeadlineHtml = renderToStaticMarkup(
        createElement(EventClockControls, {
          eventId: "e1",
          status: "ended",
          participants: 5,
          durationMinutes: 90,
          deadlineAt: "2026-10-28T19:30:00.000Z",
          endedAt: null,
        }),
      );
      expect(endedAtDeadlineHtml).toContain("The event reached its deadline.");
      expect(endedAtDeadlineHtml).toContain("Extend +10");
    });
  });
});
