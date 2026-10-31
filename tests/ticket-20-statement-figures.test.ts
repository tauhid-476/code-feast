import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { events } from "@/lib/db/schema";
import {
  confirmFigure,
  mintFigure,
  reconcileFigures,
  sweepStalePending,
} from "@/lib/figures/manage";
import { canReadFigure, listFigures } from "@/lib/figures/queries";
import { MAX_FIGURE_BYTES } from "@/lib/figures/types";
import { createProblem, updateProblem } from "@/lib/problems/manage";
import { addMinutes } from "@/lib/time";
import { db, useCleanDatabase } from "./helpers/db";
import { FakeFigureStorage } from "./helpers/fake-figure-storage";
import {
  insertEvent,
  insertFigure,
  insertParticipant,
  insertProblem,
  testUser,
  type TestUser,
} from "./helpers/factories";

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

const organizer = testUser({ email: "organizer@example.com" });
const otherOrganizer = testUser({ email: "co-organizer@example.com" });
const solver = testUser({ email: "solver@example.com" });
const stranger = testUser({ email: "stranger@example.com" });

function actor(user: TestUser) {
  return { id: user.id, email: user.email };
}

const twoCases = [
  { input: "2 7 11 15\n9\n", expectedOutput: "0 1\n" },
  { input: "3 2 4\n6\n", expectedOutput: "1 2\n" },
];

const startsAt = new Date("2026-10-31T10:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

async function draftProblem() {
  const event = await insertEvent({
    createdBy: organizer.id,
    status: "draft",
  });
  const problem = await insertProblem(event.id);
  return { event, problem };
}

describe("Ticket 20: Figures in a problem statement", () => {
  describe("mint", () => {
    it("inserts a pending Figure and returns a presigned POST pinned to its key", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();

      const minted = await mintFigure(
        actor(organizer),
        {
          problemId: problem.id,
          contentType: "image/png",
          bytes: 2048,
          width: 640,
          height: 480,
        },
        { storage },
      );

      expect(minted.url).toBe("https://storage.example/upload");
      expect(minted.fields.key).toBe(
        `problems/${problem.id}/${minted.id}.png`,
      );

      const rows = await listFigures(problem.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: minted.id,
        state: "pending",
        contentType: "image/png",
        bytes: 2048,
        width: 640,
        height: 480,
      });
      expect(storage.presigned[0]).toMatchObject({
        key: `problems/${problem.id}/${minted.id}.png`,
        contentType: "image/png",
        bytes: 2048,
      });
    });

    it("refuses a non-organizer", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();

      await expect(
        mintFigure(
          actor(solver),
          { problemId: problem.id, contentType: "image/png", bytes: 1024 },
          { storage },
        ),
      ).rejects.toMatchObject({ code: "not_organizer" });
    });

    it("refuses once the event is no longer a draft", async () => {
      const storage = new FakeFigureStorage();
      const { event, problem } = await draftProblem();
      await db
        .update(events)
        .set({ status: "live", startsAt, deadlineAt })
        .where(eq(events.id, event.id));

      await expect(
        mintFigure(
          actor(organizer),
          { problemId: problem.id, contentType: "image/png", bytes: 1024 },
          { storage },
        ),
      ).rejects.toMatchObject({ code: "event_not_draft" });
    });

    it("refuses a seventh Figure", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();
      for (let index = 0; index < 6; index += 1) {
        await insertFigure(problem.id);
      }

      await expect(
        mintFigure(
          actor(organizer),
          { problemId: problem.id, contentType: "image/png", bytes: 1024 },
          { storage },
        ),
      ).rejects.toMatchObject({
        code: "figure_limit_reached",
        message: expect.stringContaining("6 figures"),
      });

      expect(await listFigures(problem.id)).toHaveLength(6);
    });

    it("refuses a file larger than 2MB", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();

      await expect(
        mintFigure(
          actor(organizer),
          {
            problemId: problem.id,
            contentType: "image/png",
            bytes: 3 * 1024 * 1024,
          },
          { storage },
        ),
      ).rejects.toMatchObject({ code: "figure_too_large" });
    });

    it("refuses a content type that is not PNG, JPEG or WebP", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();

      await expect(
        mintFigure(
          actor(organizer),
          {
            problemId: problem.id,
            contentType: "image/svg+xml",
            bytes: 1024,
          },
          { storage },
        ),
      ).rejects.toMatchObject({ code: "figure_type_invalid" });
    });

    it("answers storage_unavailable when the bucket is not configured", async () => {
      const { problem } = await draftProblem();

      await expect(
        mintFigure(
          actor(organizer),
          { problemId: problem.id, contentType: "image/png", bytes: 1024 },
          { storage: null },
        ),
      ).rejects.toMatchObject({ code: "storage_unavailable" });
    });

    it("removes the pending row when presigning fails", async () => {
      const storage = new FakeFigureStorage();
      storage.presignError = new Error("no bucket");
      const { problem } = await draftProblem();

      await expect(
        mintFigure(
          actor(organizer),
          { problemId: problem.id, contentType: "image/png", bytes: 1024 },
          { storage },
        ),
      ).rejects.toMatchObject({ code: "storage_unavailable" });

      expect(await listFigures(problem.id)).toHaveLength(0);
    });
  });

  describe("confirm", () => {
    it("flips a pending Figure to ready after the object is confirmed", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();

      const minted = await mintFigure(
        actor(organizer),
        { problemId: problem.id, contentType: "image/png", bytes: 2048 },
        { storage },
      );
      storage.put(`problems/${problem.id}/${minted.id}.png`, "image/png", 2048);

      const confirmed = await confirmFigure(actor(organizer), minted.id, {
        storage,
      });

      expect(confirmed).toMatchObject({ id: minted.id, state: "ready" });
      expect(confirmed.bytes).toBe(2048);
      expect(await listFigures(problem.id)).toHaveLength(1);
    });

    it("deletes the row and refuses when the object is missing", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();

      const minted = await mintFigure(
        actor(organizer),
        { problemId: problem.id, contentType: "image/png", bytes: 2048 },
        { storage },
      );

      await expect(
        confirmFigure(actor(organizer), minted.id, { storage }),
      ).rejects.toMatchObject({ code: "figure_not_found" });

      expect(await listFigures(problem.id)).toHaveLength(0);
    });
  });

  describe("reconcile", () => {
    it("deletes exactly the Figures the saved statement no longer references, object included", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();

      const kept = await insertFigure(problem.id, { storageKey: "key-kept" });
      const removedA = await insertFigure(problem.id, {
        storageKey: "key-removed-a",
      });
      const removedB = await insertFigure(problem.id, {
        storageKey: "key-removed-b",
      });
      storage.put("key-kept", "image/png");
      storage.put("key-removed-a", "image/png");
      storage.put("key-removed-b", "image/png");

      const result = await reconcileFigures(
        actor(organizer),
        problem.id,
        `![Graph](/api/figures/${kept.id})`,
        { storage },
      );

      expect(result.deleted).toBe(2);
      const remaining = await listFigures(problem.id);
      expect(remaining.map((figure) => figure.id)).toEqual([kept.id]);
      expect(storage.removed.sort()).toEqual(
        ["key-removed-a", "key-removed-b"].sort(),
      );
      expect([...storage.objects.keys()]).toEqual(["key-kept"]);
      expect(removedA.id).not.toBe(removedB.id);
    });

    it("refuses a reference to an unknown Figure and deletes nothing", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();
      await insertFigure(problem.id, { storageKey: "kept" });

      await expect(
        reconcileFigures(
          actor(organizer),
          problem.id,
          `![Ghost](/api/figures/${randomUUID()})`,
          { storage },
        ),
      ).rejects.toMatchObject({ code: "figure_not_ready" });

      expect(await listFigures(problem.id)).toHaveLength(1);
      expect(storage.removed).toHaveLength(0);
    });

    it("refuses a reference to a pending Figure", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();
      const pending = await insertFigure(problem.id, {
        state: "pending",
        storageKey: "pending",
      });

      await expect(
        reconcileFigures(
          actor(organizer),
          problem.id,
          `![Pending](/api/figures/${pending.id})`,
          { storage },
        ),
      ).rejects.toMatchObject({ code: "figure_not_ready" });
    });
  });

  describe("statement save", () => {
    it("deletes the row of a Figure removed from the statement", async () => {
      const { event } = await draftProblem();
      const problem = await createProblem(actor(organizer), event.id, {
        title: "Graph",
        statementMd: "Find the shortest path.",
        sampleCases: twoCases,
      });
      const figure = await insertFigure(problem.id, {
        storageKey: "saved-key",
      });

      await updateProblem(actor(organizer), problem.id, {
        title: "Graph",
        statementMd: `Find the shortest path.\n\n![Graph](/api/figures/${figure.id})`,
        sampleCases: twoCases,
      });
      expect(await listFigures(problem.id)).toHaveLength(1);

      await updateProblem(actor(organizer), problem.id, {
        title: "Graph",
        statementMd: "Find the shortest path.",
        sampleCases: twoCases,
      });
      expect(await listFigures(problem.id)).toHaveLength(0);
    });

    it("refuses a saved statement that references an unknown Figure", async () => {
      const { event } = await draftProblem();
      const problem = await createProblem(actor(organizer), event.id, {
        title: "Graph",
        statementMd: "Find the shortest path.",
        sampleCases: twoCases,
      });

      await expect(
        updateProblem(actor(organizer), problem.id, {
          title: "Graph",
          statementMd: `![Ghost](/api/figures/${randomUUID()})`,
          sampleCases: twoCases,
        }),
      ).rejects.toMatchObject({ code: "figure_not_ready" });
    });
  });

  describe("stale pending sweep", () => {
    it("removes pendings older than 24 hours and leaves younger ones", async () => {
      const storage = new FakeFigureStorage();
      const { problem } = await draftProblem();
      const at = new Date("2026-10-31T12:00:00.000Z");

      const old = await insertFigure(problem.id, {
        state: "pending",
        storageKey: "old",
        createdAt: addMinutes(at, -25 * 60),
      });
      const young = await insertFigure(problem.id, {
        state: "pending",
        storageKey: "young",
        createdAt: addMinutes(at, -60),
      });
      storage.put("old", "image/png");
      storage.put("young", "image/png");

      const swept = await sweepStalePending({ storage, now: at });

      expect(swept).toBe(1);
      expect(storage.removed).toEqual(["old"]);
      const remaining = await listFigures(problem.id);
      expect(remaining.map((figure) => figure.id)).toEqual([young.id]);
      expect(remaining.map((figure) => figure.id)).not.toContain(old.id);
    });
  });

  describe("read authorization", () => {
    it("lets the owning Organizer read before Start, and 404s everyone else", async () => {
      const { event, problem } = await draftProblem();
      const figure = await insertFigure(problem.id, { storageKey: "key" });
      await insertParticipant(event.id, solver);
      process.env.ADMIN_EMAILS = `${organizer.email},${otherOrganizer.email}`;

      expect(await canReadFigure(actor(organizer), figure.id)).not.toBeNull();
      expect(await canReadFigure(actor(solver), figure.id)).toBeNull();
      expect(await canReadFigure(actor(stranger), figure.id)).toBeNull();
      expect(
        await canReadFigure(actor(otherOrganizer), figure.id),
      ).toBeNull();
    });

    it("lets a joined Participant read while the event is live", async () => {
      const { event, problem } = await draftProblem();
      const figure = await insertFigure(problem.id, { storageKey: "key" });
      await insertParticipant(event.id, solver);
      await db
        .update(events)
        .set({ status: "live", startsAt, deadlineAt })
        .where(eq(events.id, event.id));

      expect(await canReadFigure(actor(solver), figure.id)).not.toBeNull();
      expect(await canReadFigure(actor(stranger), figure.id)).toBeNull();
      expect(await canReadFigure(actor(organizer), figure.id)).not.toBeNull();
    });

    it("lets a joined Participant read after the event ended", async () => {
      const { event, problem } = await draftProblem();
      const figure = await insertFigure(problem.id, { storageKey: "key" });
      await insertParticipant(event.id, solver);
      await db
        .update(events)
        .set({
          status: "ended",
          startsAt,
          deadlineAt,
          endedAt: deadlineAt,
        })
        .where(eq(events.id, event.id));

      expect(await canReadFigure(actor(solver), figure.id)).not.toBeNull();
    });

    it("does not expose a pending Figure", async () => {
      const { problem } = await draftProblem();
      const pending = await insertFigure(problem.id, {
        state: "pending",
        storageKey: "pending",
      });

      expect(await canReadFigure(actor(organizer), pending.id)).toBeNull();
      expect(await canReadFigure(actor(organizer), randomUUID())).toBeNull();
      expect(await canReadFigure(null, pending.id)).toBeNull();
    });
  });

  it("keeps the 2MB cap in one place", () => {
    expect(MAX_FIGURE_BYTES).toBe(2 * 1024 * 1024);
  });
});
