import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  participants,
  problems,
  submissionSnippets,
  submissions,
} from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { assertOrganizer, type EventActor } from "@/lib/events/manage";
import { getOrganizerEvent } from "@/lib/events/queries";
import {
  lockAtDeadline,
  participantColumns,
  toParticipant,
} from "@/lib/participants/lockout";
import {
  runAgainstSamples,
  type RunOptions,
  type RunResult,
} from "@/lib/runner/run";
import { now as serverNow } from "@/lib/time";

export type RerunSubmissionInput = {
  eventId: string;
  participantId: string;
  problemId: string;
};

/**
 * Re-runs a participant's submitted code against a problem's sample test cases.
 * It is a reading aid for the organizer, not a verdict:
 * it produces no score and modifies no participant state, drafts, or submissions.
 */
export async function rerunSubmission(
  actor: EventActor,
  input: RerunSubmissionInput,
  options: RunOptions = {},
): Promise<RunResult> {
  assertOrganizer(actor, "rerun submission");

  const event = await getOrganizerEvent(actor.id, input.eventId);
  if (!event) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }

  const at = options.now ?? serverNow();

  // If the deadline has passed, reconcile any overdue participants so their
  // status and submission are frozen before we read.
  if (event.deadlineAt && at.getTime() >= event.deadlineAt.getTime()) {
    await getDb().transaction((tx) =>
      lockAtDeadline(tx, { eventId: event.id }, event.deadlineAt!),
    );
  }

  // Verify participant belongs to this event
  const [pRow] = await getDb()
    .select(participantColumns)
    .from(participants)
    .where(
      and(
        eq(participants.id, input.participantId),
        eq(participants.eventId, input.eventId),
      ),
    )
    .limit(1);

  if (!pRow) {
    throw new DomainError(
      "participant_not_found",
      "Participant not found.",
      404,
    );
  }

  const participant = toParticipant(pRow);

  // In-progress participants cannot have their code re-run
  if (participant.status !== "locked_out") {
    throw new DomainError(
      "participant_not_locked",
      "Cannot re-run submission for a participant who is not locked out.",
      400,
    );
  }

  // Verify problem belongs to this event
  const [problem] = await getDb()
    .select({ id: problems.id })
    .from(problems)
    .where(
      and(
        eq(problems.id, input.problemId),
        eq(problems.eventId, input.eventId),
      ),
    )
    .limit(1);

  if (!problem) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }

  // Fetch participant's submission
  const [submission] = await getDb()
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.participantId, input.participantId))
    .limit(1);

  if (!submission) {
    throw new DomainError(
      "no_code_submitted",
      "No code was submitted for this problem.",
      404,
    );
  }

  // Fetch the snippet for this problem
  const [snippet] = await getDb()
    .select({
      language: submissionSnippets.language,
      code: submissionSnippets.code,
    })
    .from(submissionSnippets)
    .where(
      and(
        eq(submissionSnippets.submissionId, submission.id),
        eq(submissionSnippets.problemId, input.problemId),
      ),
    )
    .limit(1);

  if (!snippet || !snippet.language || !snippet.code) {
    throw new DomainError(
      "no_code_submitted",
      "No code was submitted for this problem.",
      404,
    );
  }

  // Execute the code against the problem's sample cases using runAgainstSamples
  return runAgainstSamples(
    {
      problemId: input.problemId,
      language: snippet.language,
      code: snippet.code,
    },
    options,
  );
}
