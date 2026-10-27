"use server";

import { redirect } from "next/navigation";
import { requireParticipant } from "@/lib/auth/guards";
import { joinEventByCode, type JoinResult } from "@/lib/participants/join";
import { actionError } from "@/lib/errors";

export async function joinAction(
  _previous: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const user = await requireParticipant();
  const code = String(formData.get("code") ?? "").trim();

  let result: JoinResult;
  try {
    result = await joinEventByCode({
      userId: user.id,
      displayName: user.name,
      email: user.email,
      code,
    });
  } catch (error) {
    return actionError(error);
  }

  // redirect() throws a control-flow error; keep it outside the try/catch.
  redirect(
    result.eventStatus === "live"
      ? `/e/${result.eventCode}/contest`
      : `/e/${result.eventCode}`,
  );
}
