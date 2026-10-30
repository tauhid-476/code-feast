import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/events/[id]/review/actions", () => ({
  toggleShortlistAction: vi.fn(),
  setShortlistAction: vi.fn(),
  loadParticipantSubmissionAction: vi.fn(),
}));
import { eq } from "drizzle-orm";
import {
  drafts,
  participants,
  violations,
} from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { finalizeLockout } from "@/lib/participants/lockout";
import {
  getReviewDashboard,
  getParticipantSubmission,
  type ParticipantSubmissionDetail,
  type ReviewParticipant,
} from "@/lib/review/queries";
import { setParticipantShortlist, toggleParticipantShortlist } from "@/lib/review/manage";
import { ReviewDashboard } from "@/components/review-dashboard";
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
const nonOrganizer = testUser({ email: "solver@example.com" });
const nonOrganizerActor = { id: nonOrganizer.id, email: nonOrganizer.email };

const solver1 = testUser({ email: "alice@example.com", name: "Alice Solver" });
const solver2 = testUser({ email: "bob@example.com", name: "Bob Solver" });
const solver3 = testUser({ email: "carol@example.com", name: "Carol Solver" });

const startsAt = new Date("2026-10-30T10:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("Ticket 16: Review dashboard and shortlist", () => {
  describe("getReviewDashboard", () => {
    it("returns roster of participants with display name, email, status, lockout reasons, elapsed time, and strike count", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV001",
        status: "live",
        startsAt,
        deadlineAt,
        durationMinutes: 90,
      });

      // Insert Alice who submitted
      const p1 = await insertParticipant(event.id, solver1, {
        status: "locked_out",
        lockoutReason: "submitted",
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 45),
        strikes: 0,
      });

      // Insert Bob who was eliminated
      const p2 = await insertParticipant(event.id, solver2, {
        status: "locked_out",
        lockoutReason: "eliminated",
        joinedAt: addMinutes(startsAt, 5),
        lockedAt: addMinutes(startsAt, 25),
        strikes: 3,
      });

      // Insert Carol who is still solving
      const p3 = await insertParticipant(event.id, solver3, {
        status: "solving",
        lockoutReason: null,
        joinedAt: addMinutes(startsAt, 10),
        lockedAt: null,
        strikes: 1,
      });

      const dashboard = await getReviewDashboard(actor, event.id, {
        now: addMinutes(startsAt, 50),
      });

      expect(dashboard.event.id).toBe(event.id);
      expect(dashboard.participants).toHaveLength(3);

      const alice = dashboard.participants.find((p) => p.id === p1.id)!;
      expect(alice.displayName).toBe("Alice Solver");
      expect(alice.email).toBe("alice@example.com");
      expect(alice.status).toBe("locked_out");
      expect(alice.lockoutReason).toBe("submitted");
      expect(alice.elapsedSeconds).toBe(45 * 60);
      expect(alice.strikes).toBe(0);
      expect(alice.shortlisted).toBe(false);

      const bob = dashboard.participants.find((p) => p.id === p2.id)!;
      expect(bob.displayName).toBe("Bob Solver");
      expect(bob.status).toBe("locked_out");
      expect(bob.lockoutReason).toBe("eliminated");
      expect(bob.elapsedSeconds).toBe(20 * 60);
      expect(bob.strikes).toBe(3);

      const carol = dashboard.participants.find((p) => p.id === p3.id)!;
      expect(carol.displayName).toBe("Carol Solver");
      expect(carol.status).toBe("solving");
      expect(carol.lockoutReason).toBeNull();
      expect(carol.lockedAt).toBeNull();
      expect(carol.strikes).toBe(1);

      // Verify no winner field exists on participant objects
      for (const p of dashboard.participants) {
        expect("winner" in p).toBe(false);
      }
    });

    it("refuses non-organizers and non-event owners", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV002",
        status: "live",
      });

      await expect(
        getReviewDashboard(nonOrganizerActor, event.id),
      ).rejects.toThrow(/organizer/i);

      const otherOrganizer = testUser({ email: "other@example.com" });
      process.env.ADMIN_EMAILS = `${organizer.email},${otherOrganizer.email}`;

      await expect(
        getReviewDashboard({ id: otherOrganizer.id, email: otherOrganizer.email }, event.id),
      ).rejects.toThrow(/not found/i);
    });

    it("reconciles deadline lockouts when dashboard is loaded past the deadline", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV003",
        status: "live",
        startsAt,
        deadlineAt,
        durationMinutes: 90,
      });

      const p1 = await insertParticipant(event.id, solver1, {
        status: "solving",
        joinedAt: startsAt,
        lockedAt: null,
        lockoutReason: null,
      });

      // Load dashboard after deadline
      const afterDeadline = addMinutes(deadlineAt, 10);
      const dashboard = await getReviewDashboard(actor, event.id, {
        now: afterDeadline,
      });

      const participant = dashboard.participants.find((p) => p.id === p1.id)!;
      expect(participant.status).toBe("locked_out");
      expect(participant.lockoutReason).toBe("deadline");
      expect(participant.lockedAt?.toISOString()).toBe(deadlineAt.toISOString());
      expect(participant.elapsedSeconds).toBe(90 * 60);

      // Verify DB row was updated with deadline reconciliation
      const [row] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, p1.id));
      expect(row.status).toBe("locked_out");
      expect(row.lockoutReason).toBe("deadline");
      expect(row.lockedAt?.toISOString()).toBe(deadlineAt.toISOString());
    });
  });

  describe("getParticipantSubmission", () => {
    it("returns submission snippets per problem and all recorded violations including uncounted blocked attempts", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV004",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const prob1 = await insertProblem(event.id, {
        position: 1,
        title: "Two Sum",
      });
      const prob2 = await insertProblem(event.id, {
        position: 2,
        title: "Valid Palindrome",
      });

      const p1 = await insertParticipant(event.id, solver1, {
        status: "solving",
        joinedAt: startsAt,
      });

      // Save drafts for prob1 in python and prob2 in cpp
      await db.insert(drafts).values([
        {
          participantId: p1.id,
          problemId: prob1.id,
          language: "python",
          code: "def two_sum(): return [0, 1]",
          updatedAt: addMinutes(startsAt, 20),
        },
        {
          participantId: p1.id,
          problemId: prob2.id,
          language: "cpp",
          code: "bool isPalindrome() { return true; }",
          updatedAt: addMinutes(startsAt, 30),
        },
      ]);

      // Record violations: one uncounted blocked paste, one counted focus lost, one uncounted context menu
      const t1 = addMinutes(startsAt, 10);
      const t2 = addMinutes(startsAt, 15);
      const t3 = addMinutes(startsAt, 25);
      await db.insert(violations).values([
        {
          participantId: p1.id,
          kind: "paste_blocked",
          counted: false,
          createdAt: t1,
        },
        {
          participantId: p1.id,
          kind: "focus_lost",
          counted: true,
          createdAt: t2,
        },
        {
          participantId: p1.id,
          kind: "context_menu_blocked",
          counted: false,
          createdAt: t3,
        },
      ]);

      // Lock participant out by submitting
      const lockedAt = addMinutes(startsAt, 40);
      await finalizeLockout(db, p1.id, {
        reason: "submitted",
        lockedAt,
      });

      const detail = await getParticipantSubmission(actor, event.id, p1.id);

      expect(detail.participant.id).toBe(p1.id);
      expect(detail.participant.status).toBe("locked_out");
      expect(detail.participant.lockoutReason).toBe("submitted");
      expect(detail.submission).not.toBeNull();
      expect(detail.submission?.reason).toBe("submitted");

      // Verify snippets per problem
      expect(detail.snippets).toHaveLength(2);
      const s1 = detail.snippets.find((s) => s.problemId === prob1.id)!;
      expect(s1.problemTitle).toBe("Two Sum");
      expect(s1.language).toBe("python");
      expect(s1.code).toContain("def two_sum");

      const s2 = detail.snippets.find((s) => s.problemId === prob2.id)!;
      expect(s2.problemTitle).toBe("Valid Palindrome");
      expect(s2.language).toBe("cpp");
      expect(s2.code).toContain("bool isPalindrome");

      // Verify strike & violation log: all 3 violations recorded in chronological order
      expect(detail.violations).toHaveLength(3);
      expect(detail.violations[0].kind).toBe("paste_blocked");
      expect(detail.violations[0].counted).toBe(false);
      expect(detail.violations[0].createdAt.toISOString()).toBe(t1.toISOString());

      expect(detail.violations[1].kind).toBe("focus_lost");
      expect(detail.violations[1].counted).toBe(true);
      expect(detail.violations[1].createdAt.toISOString()).toBe(t2.toISOString());

      expect(detail.violations[2].kind).toBe("context_menu_blocked");
      expect(detail.violations[2].counted).toBe(false);
      expect(detail.violations[2].createdAt.toISOString()).toBe(t3.toISOString());
    });

    it("does not expose in-progress code for participants who have not locked out", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV005",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const prob = await insertProblem(event.id, { title: "In-Progress Problem" });

      const p1 = await insertParticipant(event.id, solver1, {
        status: "solving",
        joinedAt: startsAt,
      });

      // Put draft in DB
      await db.insert(drafts).values({
        participantId: p1.id,
        problemId: prob.id,
        language: "python",
        code: "secret in-progress draft",
      });

      const detail = await getParticipantSubmission(actor, event.id, p1.id, {
        now: addMinutes(startsAt, 20),
      });

      expect(detail.participant.status).toBe("solving");
      expect(detail.submission).toBeNull();
      expect(detail.snippets).toHaveLength(0);
    });

    it("shows all recorded strikes for an eliminated participant even if fewer than 3 are counted", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV006",
        status: "live",
        startsAt,
        deadlineAt,
      });

      const p = await insertParticipant(event.id, solver2, {
        status: "locked_out",
        lockoutReason: "eliminated",
        strikes: 2, // e.g. edge case or manual elimination
        joinedAt: startsAt,
        lockedAt: addMinutes(startsAt, 15),
      });

      await db.insert(violations).values([
        {
          participantId: p.id,
          kind: "fullscreen_exit",
          counted: true,
          createdAt: addMinutes(startsAt, 5),
        },
        {
          participantId: p.id,
          kind: "paste_blocked",
          counted: false,
          createdAt: addMinutes(startsAt, 8),
        },
        {
          participantId: p.id,
          kind: "focus_lost",
          counted: true,
          createdAt: addMinutes(startsAt, 12),
        },
      ]);

      const detail = await getParticipantSubmission(actor, event.id, p.id);
      expect(detail.violations).toHaveLength(3);
    });
  });

  describe("setParticipantShortlist", () => {
    it("persists the shortlisted mark and toggles it", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV007",
        status: "live",
      });

      const p = await insertParticipant(event.id, solver1, {
        shortlisted: false,
          activeSessionId: null,
      });

      // Mark shortlisted
      const res1 = await setParticipantShortlist(actor, event.id, p.id, true);
      expect(res1.shortlisted).toBe(true);

      const [row1] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, p.id));
      expect(row1.shortlisted).toBe(true);

      // Unmark shortlisted
      const res2 = await setParticipantShortlist(actor, event.id, p.id, false);
      expect(res2.shortlisted).toBe(false);

      const [row2] = await db
        .select()
        .from(participants)
        .where(eq(participants.id, p.id));
      expect(row2.shortlisted).toBe(false);

      // Test toggle function
      const res3 = await toggleParticipantShortlist(actor, event.id, p.id);
      expect(res3.shortlisted).toBe(true);

      const res4 = await toggleParticipantShortlist(actor, event.id, p.id);
      expect(res4.shortlisted).toBe(false);
    });

    it("refuses non-organizers from toggling shortlist", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REV008",
      });
      const p = await insertParticipant(event.id, solver1);

      await expect(
        setParticipantShortlist(nonOrganizerActor, event.id, p.id, true),
      ).rejects.toThrow(/organizer/i);
    });
  });

  describe("ReviewDashboard UI Component", () => {
    it("renders roster table with participants and strike log without any winner field", () => {
      const participantsList: ReviewParticipant[] = [
        {
          id: "p1",
          eventId: "e1",
          userId: "u1",
          displayName: "Alice Solver",
          email: "alice@example.com",
          status: "locked_out",
          lockoutReason: "submitted",
          joinedAt: startsAt,
          lockedAt: addMinutes(startsAt, 30),
          elapsedSeconds: 1800,
          strikes: 0,
          shortlisted: true,
          activeSessionId: null,
        },
        {
          id: "p2",
          eventId: "e1",
          userId: "u2",
          displayName: "Bob Solver",
          email: "bob@example.com",
          status: "solving",
          lockoutReason: null,
          joinedAt: startsAt,
          lockedAt: null,
          elapsedSeconds: null,
          strikes: 1,
          shortlisted: false,
          activeSessionId: null,
        },
      ];

      const detail: ParticipantSubmissionDetail = {
        participant: participantsList[0],
        submission: {
          id: "sub-1",
          lockedAt: addMinutes(startsAt, 30),
          reason: "submitted",
          createdAt: addMinutes(startsAt, 30),
        },
        snippets: [
          {
            problemId: "prob-1",
            problemTitle: "Reverse String",
            position: 1,
            language: "python",
            code: "def reverse_string(s): return s[::-1]",
          },
        ],
        violations: [
          {
            id: "v1",
            kind: "paste_blocked",
            counted: false,
            createdAt: addMinutes(startsAt, 10),
          },
          {
            id: "v2",
            kind: "focus_lost",
            counted: true,
            createdAt: addMinutes(startsAt, 15),
          },
        ],
      };

      const html = renderToStaticMarkup(
        createElement(ReviewDashboard, {
          eventId: "e1",
          initialParticipants: participantsList,
          initialSelectedDetail: detail,
        })
      );

      // Verify participant display names and emails
      expect(html).toContain("Alice Solver");
      expect(html).toContain("alice@example.com");
      expect(html).toContain("Bob Solver");
      expect(html).toContain("bob@example.com");

      // Verify reason badges
      expect(html).toContain("Submitted");

      // Verify problem title and language
      expect(html).toContain("Reverse String");
      expect(html).toContain("python");

      // Verify violations log
      expect(html).toContain("Paste attempt (blocked)");
      expect(html).toContain("Blocked (uncounted)");
      expect(html).toContain("Lost window focus (strike)");
      expect(html).toContain("Strike (counted)");

      // Verify shortlist
      expect(html).toContain("Shortlist");

      // Verify NO winner field anywhere
      expect(html.toLowerCase()).not.toContain("winner");
      expect(html.toLowerCase()).not.toContain("podium");
    });

    it("displays in-progress notice when viewing an active participant", () => {
      const activeParticipant: ReviewParticipant = {
        id: "p3",
        eventId: "e1",
        userId: "u3",
        displayName: "Carol Active",
        email: "carol@example.com",
        status: "solving",
        lockoutReason: null,
        joinedAt: startsAt,
        lockedAt: null,
        elapsedSeconds: null,
        strikes: 0,
        shortlisted: false,
          activeSessionId: null,
      };

      const detail: ParticipantSubmissionDetail = {
        participant: activeParticipant,
        submission: null,
        snippets: [],
        violations: [],
      };

      const html = renderToStaticMarkup(
        createElement(ReviewDashboard, {
          eventId: "e1",
          initialParticipants: [activeParticipant],
          initialSelectedDetail: detail,
        })
      );

      expect(html).toContain("Submission not available");
      expect(html).toContain("currently solving and has not been locked out yet");
      expect(html).toContain("No strikes or violations recorded");
    });
  });
});
