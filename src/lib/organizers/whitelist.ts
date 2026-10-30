import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { approvedOrganizers } from "@/lib/db/schema";
import { isOrganizerEmail } from "@/lib/env";
import { DomainError } from "@/lib/errors";

export type ApprovedOrganizer = {
  id: string;
  email: string;
  note: string | null;
  createdAt: Date;
};

const emailSchema = z.string().trim().email();

export async function isApprovedOrganizer(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  if (isOrganizerEmail(email)) return true;

  const normalized = email.trim().toLowerCase();
  const [row] = await getDb()
    .select({ id: approvedOrganizers.id })
    .from(approvedOrganizers)
    .where(sql`lower(${approvedOrganizers.email}) = ${normalized}`)
    .limit(1);

  return Boolean(row);
}

export async function listApprovedOrganizers(): Promise<ApprovedOrganizer[]> {
  return getDb()
    .select({
      id: approvedOrganizers.id,
      email: approvedOrganizers.email,
      note: approvedOrganizers.note,
      createdAt: approvedOrganizers.createdAt,
    })
    .from(approvedOrganizers)
    .orderBy(desc(approvedOrganizers.createdAt));
}

export async function addApprovedOrganizer(input: {
  email: string;
  note?: string | null;
}): Promise<ApprovedOrganizer> {
  const result = emailSchema.safeParse(input.email);
  if (!result.success) {
    throw new DomainError(
      "invalid_email",
      "Please enter a valid email address.",
      400,
    );
  }

  const email = result.data.toLowerCase();
  const note = input.note?.trim() || null;

  // Check if already approved in the database
  const [existing] = await getDb()
    .select({ id: approvedOrganizers.id })
    .from(approvedOrganizers)
    .where(sql`lower(${approvedOrganizers.email}) = ${email}`)
    .limit(1);

  if (existing) {
    throw new DomainError(
      "organizer_already_whitelisted",
      "This email is already in the approved organizers list.",
      409,
    );
  }

  const [row] = await getDb()
    .insert(approvedOrganizers)
    .values({
      email,
      note,
    })
    .returning({
      id: approvedOrganizers.id,
      email: approvedOrganizers.email,
      note: approvedOrganizers.note,
      createdAt: approvedOrganizers.createdAt,
    });

  return row;
}

export async function removeApprovedOrganizer(id: string): Promise<boolean> {
  const [deleted] = await getDb()
    .delete(approvedOrganizers)
    .where(eq(approvedOrganizers.id, id))
    .returning({ id: approvedOrganizers.id });

  return Boolean(deleted);
}
