"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import { createEvent, regenerateJoinCode } from "@/lib/events/manage";

export type CreateEventState =
  | { error: string }
  | { created: { id: string; code: string } }
  | null;

export type RegenerateCodeState = { error: string } | { code: string };

export async function createEventAction(
  _previous: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const organizer = await requireOrganizer();

  try {
    const event = await createEvent(
      { id: organizer.id, email: organizer.email },
      {
        title: String(formData.get("title") ?? ""),
        durationMinutes: Number(formData.get("durationMinutes")),
      },
    );
    revalidatePath("/admin/events");
    return { created: { id: event.id, code: event.code } };
  } catch (error) {
    return actionError(error);
  }
}

export async function regenerateCodeAction(
  eventId: string,
): Promise<RegenerateCodeState> {
  const organizer = await requireOrganizer();

  try {
    const event = await regenerateJoinCode(
      { id: organizer.id, email: organizer.email },
      eventId,
    );
    revalidatePath("/admin/events");
    return { code: event.code };
  } catch (error) {
    return actionError(error);
  }
}
