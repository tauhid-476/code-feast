import { afterEach, describe, expect, it } from "vitest";
import { isOrganizerEmail } from "@/lib/env";
import { landingFor, type Viewer } from "@/lib/auth/roles";
import { listOrganizerEvents } from "@/lib/events/queries";
import { insertEvent } from "./helpers/factories";
import { useCleanDatabase } from "./helpers/db";

useCleanDatabase();

const originalAdminEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("organizer role gate", () => {
  it("treats every email in ADMIN_EMAILS as an organizer, case-insensitively", () => {
    process.env.ADMIN_EMAILS = " First@Example.com , second@example.com ";

    expect(isOrganizerEmail("first@example.com")).toBe(true);
    expect(isOrganizerEmail("SECOND@EXAMPLE.COM")).toBe(true);
    expect(isOrganizerEmail("someone@example.com")).toBe(false);
    expect(isOrganizerEmail(null)).toBe(false);
  });

  it("grants the organizer role from the list alone, with no code change", () => {
    process.env.ADMIN_EMAILS = "organizer@example.com";
    expect(isOrganizerEmail("organizer@example.com")).toBe(true);

    // Adding a second email is the whole migration.
    process.env.ADMIN_EMAILS = "organizer@example.com, co-organizer@example.com";
    expect(isOrganizerEmail("co-organizer@example.com")).toBe(true);
  });

  it("treats an empty ADMIN_EMAILS as no organizers", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isOrganizerEmail("anyone@example.com")).toBe(false);
  });
});

describe("landing by role", () => {
  const user = { id: "u1", email: "a@example.com", name: "a" };

  it("sends a signed-out visitor to sign-in", () => {
    expect(landingFor({ kind: "anonymous" } as Viewer)).toBe("/sign-in");
  });

  it("sends an organizer to the admin events list", () => {
    expect(landingFor({ kind: "organizer", user })).toBe("/admin/events");
  });

  it("sends a participant to join code entry", () => {
    expect(landingFor({ kind: "participant", user })).toBe("/join");
  });
});

describe("organizer event list", () => {
  it("shows only the organizer's own events, newest first", async () => {
    const mine = "organizer-1";
    const theirs = "organizer-2";

    await insertEvent({ title: "Older", createdBy: mine, code: "OLD111" });
    const newer = await insertEvent({
      title: "Newer",
      createdBy: mine,
      code: "NEW222",
    });
    await insertEvent({ title: "Not mine", createdBy: theirs, code: "THE333" });

    const events = await listOrganizerEvents(mine);

    expect(events.map((event) => event.title)).toEqual(["Newer", "Older"]);
    expect(events[0].id).toBe(newer.id);
    expect(events.some((event) => event.title === "Not mine")).toBe(false);
  });

  it("returns an empty list for an organizer with no events", async () => {
    await expect(listOrganizerEvents("nobody")).resolves.toEqual([]);
  });
});
