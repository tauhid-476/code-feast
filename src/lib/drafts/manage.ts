import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { drafts, participants, problems } from "@/lib/db/schema";
import { isLanguage, type Language } from "@/lib/languages";
import { DomainError } from "@/lib/errors";
import type { ParticipantContext } from "@/lib/participants/queries";
import { requireActiveSession } from "@/lib/participants/session";
import { now as serverNow } from "@/lib/time";

/**
 * The Participant's autosaved work, per Problem per language (SPEC §9 names
 * `/api/draft` for this). The context is the only input, so a caller cannot
 * skip the loader's deadline reconciliation.
 */

export type ContestDraft = {
  problemId: string;
  language: Language;
  code: string;
  updatedAt: Date;
};

export type DraftInput = {
  problemId: string;
  language: Language;
  code: string;
};

const draftColumns = {
  problemId: drafts.problemId,
  language: drafts.language,
  code: drafts.code,
  updatedAt: drafts.updatedAt,
};

function toDraft(row: {
  problemId: string;
  language: string;
  code: string;
  updatedAt: Date;
}): ContestDraft | null {
  if (!isLanguage(row.language)) return null;
  return {
    problemId: row.problemId,
    language: row.language,
    code: row.code,
    updatedAt: row.updatedAt,
  };
}

export type DraftOptions = {
  /** Tests move the clock; the app never passes this. */
  now?: Date;
  /**
   * The tab saving. A displaced tab is refused, and the check
   * runs under the participant row lock so a save already in flight when the
   * takeover commits cannot overwrite the winner's code (ticket 14).
   */
  sessionId?: string | null;
};

/**
 * The one autosave write. A draft only exists while the contest is open: a
 * closed event or a locked participant refuses the write rather than silently
 * keeping an artifact the review screen will never see.
 *
 * `updated_at` comes from the server, never the client, so the merge rule and
 * the review screen read the same clock.
 */
export async function saveDraft(
  context: ParticipantContext | null,
  input: DraftInput,
  options: DraftOptions = {},
): Promise<ContestDraft> {
  const participant = context?.participant;
  if (!participant) {
    throw new DomainError(
      "not_joined",
      "Join this event before saving your work.",
      403,
    );
  }
  if (participant.status === "locked_out") {
    throw new DomainError(
      "contest_locked",
      "Your contest is locked. Code can no longer be saved.",
      409,
    );
  }
  if (context.event.status !== "live") {
    throw new DomainError(
      "contest_not_open",
      "This event is not live. Code cannot be saved yet.",
      409,
    );
  }
  if (!isLanguage(input.language)) {
    throw new DomainError("invalid_language", "That language is not supported.");
  }

  const [problem] = await getDb()
    .select({ id: problems.id })
    .from(problems)
    .where(and(eq(problems.id, input.problemId), eq(problems.eventId, context.event.id)))
    .limit(1);
  if (!problem) {
    throw new DomainError(
      "problem_not_found",
      "That problem is not part of this event.",
      404,
    );
  }

  const at = options.now ?? serverNow();

  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: participants.status,
        activeSessionId: participants.activeSessionId,
      })
      .from(participants)
      .where(eq(participants.id, participant.id))
      .for("update");

    if (!current) {
      throw new DomainError(
        "not_joined",
        "Join this event before saving your work.",
        403,
      );
    }
    if (current.status === "locked_out") {
      throw new DomainError(
        "contest_locked",
        "Your contest is locked. Code can no longer be saved.",
        409,
      );
    }
    requireActiveSession(current, options.sessionId ?? null);

    const [row] = await tx
      .insert(drafts)
      .values({
        participantId: participant.id,
        problemId: input.problemId,
        language: input.language,
        code: input.code,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [drafts.participantId, drafts.problemId, drafts.language],
        set: { code: input.code, updatedAt: at },
      })
      .returning(draftColumns);

    const saved = toDraft(row);
    if (!saved) {
      throw new DomainError("invalid_language", "That language is not supported.");
    }
    return saved;
  });
}

/** Everything this Participant has saved, for the first render of the contest. */
export async function listDrafts(
  context: ParticipantContext | null,
): Promise<ContestDraft[]> {
  if (!context?.participant) return [];

  const rows = await getDb()
    .select(draftColumns)
    .from(drafts)
    .where(eq(drafts.participantId, context.participant.id))
    .orderBy(asc(drafts.problemId), asc(drafts.language));

  return rows.flatMap((row) => {
    const draft = toDraft(row);
    return draft ? [draft] : [];
  });
}
