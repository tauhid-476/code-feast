"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/auth/guards";
import { actionError } from "@/lib/errors";
import {
  createEvent,
  regenerateJoinCode,
  updateEventSettings,
} from "@/lib/events/manage";

export type CreateEventState =
  | { error: string }
  | { created: { id: string; code: string } }
  | null;

export type RegenerateCodeState = { error: string } | { code: string };

export type UpdateEventSettingsState = { error: string } | { ok: true };

export async function createEventAction(
  _previous: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const organizer = await requireOrganizer();
  const e2bApiKey = formData.get("e2bApiKey");

  try {
    const event = await createEvent(
      { id: organizer.id, email: organizer.email },
      {
        title: String(formData.get("title") ?? ""),
        durationMinutes: Number(formData.get("durationMinutes")),
        e2bApiKey: typeof e2bApiKey === "string" ? e2bApiKey : undefined,
      },
    );
    revalidatePath("/admin/events");
    return { created: { id: event.id, code: event.code } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEventSettingsAction(
  eventId: string,
  _previous: UpdateEventSettingsState | null,
  formData: FormData,
): Promise<UpdateEventSettingsState> {
  const organizer = await requireOrganizer();
  const title = formData.get("title");
  const durationMinutes = formData.get("durationMinutes");
  const e2bApiKey = formData.get("e2bApiKey");

  try {
    await updateEventSettings(
      { id: organizer.id, email: organizer.email },
      eventId,
      {
        title: typeof title === "string" ? title : undefined,
        durationMinutes:
          durationMinutes !== null && durationMinutes !== ""
            ? Number(durationMinutes)
            : undefined,
        e2bApiKey: typeof e2bApiKey === "string" ? e2bApiKey : undefined,
      },
    );
    revalidatePath(`/admin/events/${eventId}`);
    revalidatePath("/admin/events");
    return { ok: true };
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
