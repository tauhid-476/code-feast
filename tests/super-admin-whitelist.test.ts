import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { events } from "@/lib/db/schema";
import { isSuperAdminEmail } from "@/lib/env";
import {
  addApprovedOrganizer,
  isApprovedOrganizer,
  listApprovedOrganizers,
  removeApprovedOrganizer,
} from "@/lib/organizers/whitelist";
import { createEvent } from "@/lib/events/manage";
import { db, useCleanDatabase } from "./helpers/db";
import { testUser } from "./helpers/factories";

useCleanDatabase();

const originalSuperAdmin = process.env.SUPER_ADMIN_EMAILS;
const originalAdmin = process.env.ADMIN_EMAILS;

const superAdmin = "superadmin@example.com";
const organizer = "organizer@college.edu";
const regularUser = "student@college.edu";

beforeEach(() => {
  process.env.SUPER_ADMIN_EMAILS = superAdmin;
  process.env.ADMIN_EMAILS = superAdmin;
});

afterEach(() => {
  if (originalSuperAdmin !== undefined) {
    process.env.SUPER_ADMIN_EMAILS = originalSuperAdmin;
  } else {
    delete process.env.SUPER_ADMIN_EMAILS;
  }
  if (originalAdmin !== undefined) {
    process.env.ADMIN_EMAILS = originalAdmin;
  } else {
    delete process.env.ADMIN_EMAILS;
  }
});

describe("Super-Admin Whitelist", () => {
  describe("isSuperAdminEmail", () => {
    it("recognizes emails in SUPER_ADMIN_EMAILS", () => {
      expect(isSuperAdminEmail(superAdmin)).toBe(true);
      expect(isSuperAdminEmail("  SUPERADMIN@EXAMPLE.COM  ")).toBe(true);
      expect(isSuperAdminEmail("other@example.com")).toBe(false);
    });

    it("falls back to ADMIN_EMAILS when SUPER_ADMIN_EMAILS is unset", () => {
      delete process.env.SUPER_ADMIN_EMAILS;
      process.env.ADMIN_EMAILS = "admin1@example.com, admin2@example.com";
      expect(isSuperAdminEmail("admin1@example.com")).toBe(true);
      expect(isSuperAdminEmail("admin2@example.com")).toBe(true);
      expect(isSuperAdminEmail("other@example.com")).toBe(false);
    });
  });

  describe("Whitelisting Organizers", () => {
    it("super admin is always an approved organizer", async () => {
      expect(await isApprovedOrganizer(superAdmin)).toBe(true);
    });

    it("unwhitelisted email is not an approved organizer", async () => {
      expect(await isApprovedOrganizer(regularUser)).toBe(false);
    });

    it("adding an organizer allows them to be approved", async () => {
      const added = await addApprovedOrganizer({
        email: organizer,
        note: "Tech Lead at University ACM",
      });

      expect(added.email).toBe(organizer);
      expect(added.note).toBe("Tech Lead at University ACM");
      expect(await isApprovedOrganizer(organizer)).toBe(true);
      expect(await isApprovedOrganizer(organizer.toUpperCase())).toBe(true);

      const list = await listApprovedOrganizers();
      expect(list).toHaveLength(1);
      expect(list[0].email).toBe(organizer);
    });

    it("refuses adding invalid email addresses", async () => {
      await expect(
        addApprovedOrganizer({ email: "not-an-email" }),
      ).rejects.toThrow();
    });

    it("refuses duplicate email insertion", async () => {
      await addApprovedOrganizer({ email: organizer });
      await expect(
        addApprovedOrganizer({ email: organizer }),
      ).rejects.toThrow();
    });

    it("removing an organizer revokes their approval", async () => {
      const added = await addApprovedOrganizer({
        email: organizer,
      });
      expect(await isApprovedOrganizer(organizer)).toBe(true);

      await removeApprovedOrganizer(added.id);
      expect(await isApprovedOrganizer(organizer)).toBe(false);
      expect(await listApprovedOrganizers()).toHaveLength(0);
    });
  });

  describe("Organizer permissions with Whitelist", () => {
    it("allows approved organizer to create an event", async () => {
      await addApprovedOrganizer({ email: organizer });
      const user = testUser({ email: organizer });

      const event = await createEvent(
        { id: user.id, email: user.email },
        { title: "Campus Hackathon 2026", durationMinutes: 120 },
      );

      expect(event.title).toBe("Campus Hackathon 2026");
      const [row] = await db
        .select()
        .from(events)
        .where(eq(events.id, event.id));
      expect(row?.createdBy).toBe(user.id);
    });

    it("refuses non-whitelisted user from creating an event", async () => {
      const user = testUser({ email: regularUser });

      await expect(
        createEvent(
          { id: user.id, email: user.email },
          { title: "Unauthorized Event", durationMinutes: 60 },
        ),
      ).rejects.toThrow();
    });
  });
});
