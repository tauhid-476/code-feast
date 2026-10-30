import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { events, runnerPool } from "@/lib/db/schema";
import { createEvent, updateEventSettings } from "@/lib/events/manage";
import {
  claimSandbox,
  getReadyCount,
  releaseSandbox,
  replenishPool,
  resolveProviderForEvent,
  teardownEventSandboxes,
} from "@/lib/runner/pool";
import { e2bSandboxProvider } from "@/lib/runner/sandbox";
import { db, useCleanDatabase } from "./helpers/db";
import { insertEvent, testUser } from "./helpers/factories";
import { FakeSandboxProvider } from "./helpers/fake-sandbox-provider";

useCleanDatabase();

const organizer = testUser({ email: "organizer@example.com" });
const actor = { id: organizer.id, email: organizer.email };

describe("Runner Pool BYOK and Scoping", () => {
  describe("resolveProviderForEvent", () => {
    it("returns platform default provider when event has no e2bApiKey", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "NOKEY1",
      });

      const provider = await resolveProviderForEvent(event.id);
      expect(provider).toBe(e2bSandboxProvider);

      const noEventProvider = await resolveProviderForEvent(undefined);
      expect(noEventProvider).toBe(e2bSandboxProvider);
    });

    it("returns custom E2B provider when event has custom e2bApiKey", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "KEY001",
        e2bApiKey: "e2b_custom_api_key_12345",
      });

      const provider = await resolveProviderForEvent(event.id);
      expect(provider).not.toBe(e2bSandboxProvider);
    });
  });

  describe("Event creation and settings with BYOK", () => {
    it("stores e2bApiKey on event creation", async () => {
      process.env.ADMIN_EMAILS = organizer.email;
      const event = await createEvent(actor, {
        title: "BYOK Contest",
        durationMinutes: 60,
        e2bApiKey: "e2b_event_key_abc",
      });

      expect(event.e2bApiKey).toBe("e2b_event_key_abc");

      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.id, event.id));
      expect(row?.e2bApiKey).toBe("e2b_event_key_abc");
    });

    it("allows updating e2bApiKey in draft status", async () => {
      process.env.ADMIN_EMAILS = organizer.email;
      const event = await createEvent(actor, {
        title: "Draft Contest",
        durationMinutes: 90,
      });
      expect(event.e2bApiKey).toBeNull();

      await updateEventSettings(actor, event.id, {
        e2bApiKey: "e2b_updated_key_xyz",
      });

      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.id, event.id));
      expect(row?.e2bApiKey).toBe("e2b_updated_key_xyz");
    });
  });

  describe("Scoped replenish and claim", () => {
    it("replenishPool tags rows with eventId", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "REP001",
      });

      const provider = new FakeSandboxProvider();
      const created = await replenishPool({
        provider,
        target: 2,
        eventId: event.id,
      });

      expect(created).toBe(2);
      expect(provider.created).toEqual(["sandbox-1", "sandbox-2"]);

      const rows = await db
        .select()
        .from(runnerPool)
        .where(eq(runnerPool.eventId, event.id));

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.sandboxId)).toEqual(["sandbox-1", "sandbox-2"]);
      expect(rows.every((r) => r.eventId === event.id)).toBe(true);

      expect(await getReadyCount(event.id)).toBe(2);
    });

    it("claimSandbox prioritizes sandboxes scoped to the requested eventId", async () => {
      const eventA = await insertEvent({
        createdBy: organizer.id,
        code: "EVTA01",
      });
      const eventB = await insertEvent({
        createdBy: organizer.id,
        code: "EVTB01",
      });

      const provider = new FakeSandboxProvider();

      // Replenish for Event A and Event B
      await replenishPool({ provider, target: 1, eventId: eventA.id });
      await replenishPool({ provider, target: 1, eventId: eventB.id });

      const claimA = await claimSandbox({ provider, eventId: eventA.id });
      expect(claimA.sandboxId).toBe("sandbox-1");

      const claimB = await claimSandbox({ provider, eventId: eventB.id });
      expect(claimB.sandboxId).toBe("sandbox-2");

      await releaseSandbox(claimA);
      await releaseSandbox(claimB);
    });

    it("ignores sandboxes older than 55 minutes", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "STALE1",
      });

      // Insert a stale sandbox (created 56 minutes ago)
      await db.execute(sql`
        insert into runner_pool (sandbox_id, event_id, state, created_at)
        values ('sandbox-stale', ${event.id}::uuid, 'ready', now() - interval '56 minutes')
      `);

      // Insert a fresh sandbox (created 5 minutes ago)
      await db.execute(sql`
        insert into runner_pool (sandbox_id, event_id, state, created_at)
        values ('sandbox-fresh', ${event.id}::uuid, 'ready', now() - interval '5 minutes')
      `);

      expect(await getReadyCount(event.id)).toBe(1);

      const provider = new FakeSandboxProvider();
      const claim = await claimSandbox({ provider, eventId: event.id });
      expect(claim.sandboxId).toBe("sandbox-fresh");

      await releaseSandbox(claim);
    });
  });

  describe("teardownEventSandboxes", () => {
    it("kills all active sandboxes for the event and marks rows dead", async () => {
      const event = await insertEvent({
        createdBy: organizer.id,
        code: "TD0001",
      });
      const otherEvent = await insertEvent({
        createdBy: organizer.id,
        code: "TD0002",
      });

      const provider = new FakeSandboxProvider();
      await replenishPool({ provider, target: 2, eventId: event.id });
      await replenishPool({ provider, target: 1, eventId: otherEvent.id });

      expect(await getReadyCount(event.id)).toBe(2);
      expect(await getReadyCount(otherEvent.id)).toBe(1);

      const tornDown = await teardownEventSandboxes(event.id, { provider });
      expect(tornDown).toBe(2);

      // Verify sandboxes were killed
      expect(provider.killed).toEqual(["sandbox-1", "sandbox-2"]);

      // Verify rows are dead for event, but untouched for otherEvent
      expect(await getReadyCount(event.id)).toBe(0);
      expect(await getReadyCount(otherEvent.id)).toBe(1);

      const eventRows = await db
        .select()
        .from(runnerPool)
        .where(eq(runnerPool.eventId, event.id));
      expect(eventRows.every((r) => r.state === "dead")).toBe(true);

      const otherRows = await db
        .select()
        .from(runnerPool)
        .where(eq(runnerPool.eventId, otherEvent.id));
      expect(otherRows.every((r) => r.state === "ready")).toBe(true);
    });
  });
});
