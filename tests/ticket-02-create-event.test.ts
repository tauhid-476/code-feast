import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createEvent,
  regenerateJoinCode,
  type EventActor,
} from "@/lib/events/manage";
import { findEventByJoinCode, listOrganizerEvents } from "@/lib/events/queries";
import { insertEvent, testUser, type TestUser } from "./helpers/factories";
import { useCleanDatabase } from "./helpers/db";

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

const organizer = testUser({ email: "organizer@example.com" });
const participant = testUser({ email: "solver@example.com" });

function actor(user: TestUser): EventActor {
  return { id: user.id, email: user.email };
}

beforeEach(() => {
  process.env.ADMIN_EMAILS = organizer.email;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("create event", () => {
  it("creates a draft event attributed to the organizer", async () => {
    const event = await createEvent(actor(organizer), {
      title: "Friday Night Contest",
      durationMinutes: 90,
    });

    expect(event.title).toBe("Friday Night Contest");
    expect(event.status).toBe("draft");
    expect(event.durationMinutes).toBe(90);

    const listed = await listOrganizerEvents(organizer.id);
    expect(listed.map((row) => row.id)).toEqual([event.id]);
  });

  it("issues a 6-character uppercase alphanumeric join code unique among live events", async () => {
    const first = await createEvent(actor(organizer), {
      title: "First",
      durationMinutes: 60,
    });
    const second = await createEvent(actor(organizer), {
      title: "Second",
      durationMinutes: 60,
    });

    expect(first.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(second.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(second.code).not.toBe(first.code);
  });

  it("retries when the generated join code collides with a non-ended event", async () => {
    const existing = await insertEvent({ code: "AAAAAA" });
    const codes = ["AAAAAA", "BBBBBB"];
    let calls = 0;

    const event = await createEvent(
      actor(organizer),
      { title: "Fresh", durationMinutes: 45 },
      { generateCode: () => codes[calls++] ?? "CCCCCC" },
    );

    expect(calls).toBe(2);
    expect(event.code).toBe("BBBBBB");
    expect(event.id).not.toBe(existing.id);
    expect(existing.code).toBe("AAAAAA");
  });

  it("reuses the code of an ended event, because ended codes are free", async () => {
    await insertEvent({ code: "ENDED1", status: "ended" });

    const event = await createEvent(
      actor(organizer),
      { title: "Reused", durationMinutes: 30 },
      { generateCode: () => "ENDED1" },
    );

    expect(event.code).toBe("ENDED1");
    expect(event.status).toBe("draft");
  });

  it("keeps two drafts independent", async () => {
    const first = await createEvent(actor(organizer), {
      title: "Morning",
      durationMinutes: 60,
    });
    const second = await createEvent(actor(organizer), {
      title: "Evening",
      durationMinutes: 120,
    });

    const listed = await listOrganizerEvents(organizer.id);
    expect(listed).toHaveLength(2);
    expect(listed.map((row) => row.title).sort()).toEqual([
      "Evening",
      "Morning",
    ]);
    expect(listed.map((row) => row.code).sort()).toEqual(
      [first.code, second.code].sort(),
    );
  });

  it("refuses a title that is blank", async () => {
    await expect(
      createEvent(actor(organizer), { title: "   ", durationMinutes: 60 }),
    ).rejects.toMatchObject({ code: "title_required" });
  });

  it("refuses a duration that is not a positive whole number", async () => {
    await expect(
      createEvent(actor(organizer), { title: "Zero", durationMinutes: 0 }),
    ).rejects.toMatchObject({ code: "duration_invalid" });

    await expect(
      createEvent(actor(organizer), { title: "Fraction", durationMinutes: 1.5 }),
    ).rejects.toMatchObject({ code: "duration_invalid" });
  });

  it("refuses a participant actor", async () => {
    await expect(
      createEvent(actor(participant), {
        title: "Not yours",
        durationMinutes: 60,
      }),
    ).rejects.toMatchObject({ code: "not_organizer" });
  });
});

describe("regenerate join code", () => {
  it("changes the code of a draft event and stops resolving the old one", async () => {
    const event = await insertEvent({
      title: "Draft",
      code: "OLD111",
      createdBy: organizer.id,
    });

    const updated = await regenerateJoinCode(actor(organizer), event.id, {
      generateCode: () => "NEW222",
    });

    expect(updated.code).toBe("NEW222");
    await expect(findEventByJoinCode("OLD111")).resolves.toBeNull();
    const resolved = await findEventByJoinCode("NEW222");
    expect(resolved?.id).toBe(event.id);
  });

  it("retries when the replacement code is already taken", async () => {
    await insertEvent({ code: "TAKEN1", createdBy: organizer.id });
    const event = await insertEvent({
      code: "OLD111",
      createdBy: organizer.id,
    });
    const codes = ["TAKEN1", "FRESH1"];
    let calls = 0;

    const updated = await regenerateJoinCode(actor(organizer), event.id, {
      generateCode: () => codes[calls++] ?? "SPARE1",
    });

    expect(calls).toBe(2);
    expect(updated.code).toBe("FRESH1");
  });

  it("never leaves the draft with the code it already had", async () => {
    const event = await insertEvent({
      code: "SAME11",
      createdBy: organizer.id,
    });
    const codes = ["SAME11", "OTHER1"];
    let calls = 0;

    const updated = await regenerateJoinCode(actor(organizer), event.id, {
      generateCode: () => codes[calls++] ?? "SPARE1",
    });

    expect(updated.code).toBe("OTHER1");
    expect(calls).toBe(2);
  });

  it("refuses once the event is live", async () => {
    const event = await insertEvent({
      code: "LIVE11",
      status: "live",
      createdBy: organizer.id,
    });

    await expect(
      regenerateJoinCode(actor(organizer), event.id),
    ).rejects.toMatchObject({ code: "event_not_draft" });
  });

  it("refuses once the event has ended", async () => {
    const event = await insertEvent({
      code: "OVER11",
      status: "ended",
      createdBy: organizer.id,
    });

    await expect(
      regenerateJoinCode(actor(organizer), event.id),
    ).rejects.toMatchObject({ code: "event_not_draft" });
  });

  it("refuses a participant actor", async () => {
    const event = await insertEvent({
      code: "DRAFT1",
      createdBy: organizer.id,
    });

    await expect(
      regenerateJoinCode(actor(participant), event.id),
    ).rejects.toMatchObject({ code: "not_organizer" });
  });

  it("refuses an event owned by another organizer", async () => {
    const event = await insertEvent({ code: "OTHER2" });

    await expect(
      regenerateJoinCode(actor(organizer), event.id),
    ).rejects.toMatchObject({ code: "event_not_found" });
  });
});
