"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import {
  addApprovedOrganizer,
  removeApprovedOrganizer,
} from "@/lib/organizers/whitelist";

export type AddOrganizerState = { error: string } | { ok: true } | null;

export async function addApprovedOrganizerAction(
  _prev: AddOrganizerState,
  formData: FormData,
): Promise<AddOrganizerState> {
  await requireSuperAdmin();

  const email = formData.get("email");
  const note = formData.get("note");

  if (typeof email !== "string" || !email.trim()) {
    return { error: "Please provide an email address." };
  }

  try {
    await addApprovedOrganizer({
      email,
      note: typeof note === "string" ? note : undefined,
    });
    revalidatePath("/admin/organizers");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeApprovedOrganizerAction(
  id: string,
): Promise<{ error: string } | { ok: true }> {
  await requireSuperAdmin();

  try {
    await removeApprovedOrganizer(id);
    revalidatePath("/admin/organizers");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
