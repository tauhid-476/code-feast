import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  participants,
  problems,
  submissionSnippets,
  submissions,
  violations,
} from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { assertOrganizer, type EventActor } from "@/lib/events/manage";
import { getOrganizerEvent, type EventSummary } from "@/lib/events/queries";
import {
  lockAtDeadline,
  participantColumns,
  toParticipant,
  type Participant,
} from "@/lib/participants/lockout";
import { elapsedSeconds, now as serverNow } from "@/lib/time";
import type { ViolationKind } from "@/lib/violations/kinds";

export type ReviewParticipant = Participant & {
  elapsedSeconds: number | null;
};

export type ReviewDashboardView = {
  event: EventSummary;
  participants: ReviewParticipant[];
};

export type ReviewViolation = {
  id: string;
  kind: ViolationKind;
  counted: boolean;
  createdAt: Date;
};

export type ProblemSnippet = {
  problemId: string;
  problemTitle: string;
  position: number;
  language: string | null;
  code: string | null;
};

export type ParticipantSubmissionDetail = {
  participant: ReviewParticipant;
  submission: {
    id: string;
    lockedAt: Date;
    reason: string;
    createdAt: Date;
  } | null;
  snippets: ProblemSnippet[];
  violations: ReviewViolation[];
};

export type ReviewOptions = {
  now?: Date;
};

/**
 * Loads the review roster for an Event. Reconciles the deadline first so that
 * any participant whose time has run out is locked at the deadline before the
 * organizer reads the dashboard.
 */
export async function getReviewDashboard(
  actor: EventActor,
  eventId: string,
  options: ReviewOptions = {},
): Promise<ReviewDashboardView> {
  await assertOrganizer(actor, "view review dashboard");
  const event = await getOrganizerEvent(actor.id, eventId);
  if (!event) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }

  const at = options.now ?? serverNow();

  const participantRows = await getDb().transaction(async (tx) => {
    if (event.deadlineAt && at.getTime() >= event.deadlineAt.getTime()) {
      await lockAtDeadline(tx, { eventId: event.id }, event.deadlineAt);
    }

    return tx
      .select(participantColumns)
      .from(participants)
      .where(eq(participants.eventId, event.id))
      .orderBy(asc(participants.joinedAt));
  });

  const reviewParticipants: ReviewParticipant[] = participantRows.map((row) => {
    const p = toParticipant(row);
    const elapsed = p.lockedAt ? elapsedSeconds(p.joinedAt, p.lockedAt) : null;
    return {
      ...p,
      elapsedSeconds: elapsed,
    };
  });

  return {
    event,
    participants: reviewParticipants,
  };
}

/**
 * Returns a participant's frozen submission and their full strike/violation log.
 * If the participant is not locked out yet (still solving or joined), no code
 * or drafts are exposed.
 */
export async function getParticipantSubmission(
  actor: EventActor,
  eventId: string,
  participantId: string,
  options: ReviewOptions = {},
): Promise<ParticipantSubmissionDetail> {
  await assertOrganizer(actor, "view participant submission");
  const event = await getOrganizerEvent(actor.id, eventId);
  if (!event) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }

  const at = options.now ?? serverNow();

  if (event.deadlineAt && at.getTime() >= event.deadlineAt.getTime()) {
    await getDb().transaction((tx) =>
      lockAtDeadline(tx, { eventId: event.id }, event.deadlineAt!),
    );
  }

  const [pRow] = await getDb()
    .select(participantColumns)
    .from(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.eventId, eventId),
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
  const elapsed = participant.lockedAt
    ? elapsedSeconds(participant.joinedAt, participant.lockedAt)
    : null;

  const reviewParticipant: ReviewParticipant = {
    ...participant,
    elapsedSeconds: elapsed,
  };

  // Full violation log: both uncounted blocked attempts and counted strikes
  const violationRows = await getDb()
    .select({
      id: violations.id,
      kind: violations.kind,
      counted: violations.counted,
      createdAt: violations.createdAt,
    })
    .from(violations)
    .where(eq(violations.participantId, participant.id))
    .orderBy(asc(violations.createdAt));

  const reviewViolations: ReviewViolation[] = violationRows.map((v) => ({
    id: v.id,
    kind: v.kind as ViolationKind,
    counted: v.counted,
    createdAt: v.createdAt,
  }));

  // Fetch all problems for the event
  const eventProblems = await getDb()
    .select({
      id: problems.id,
      title: problems.title,
      position: problems.position,
    })
    .from(problems)
    .where(eq(problems.eventId, eventId))
    .orderBy(asc(problems.position));

  // In-progress participants never expose live code or drafts
  if (participant.status !== "locked_out") {
    return {
      participant: reviewParticipant,
      submission: null,
      snippets: [],
      violations: reviewViolations,
    };
  }

  const [submissionRow] = await getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.participantId, participant.id))
    .limit(1);

  if (!submissionRow) {
    return {
      participant: reviewParticipant,
      submission: null,
      snippets: eventProblems.map((pr) => ({
        problemId: pr.id,
        problemTitle: pr.title,
        position: pr.position,
        language: null,
        code: null,
      })),
      violations: reviewViolations,
    };
  }

  const snippetRows = await getDb()
    .select()
    .from(submissionSnippets)
    .where(eq(submissionSnippets.submissionId, submissionRow.id));

  const snippetMap = new Map(snippetRows.map((s) => [s.problemId, s]));

  const snippets: ProblemSnippet[] = eventProblems.map((pr) => {
    const s = snippetMap.get(pr.id);
    return {
      problemId: pr.id,
      problemTitle: pr.title,
      position: pr.position,
      language: s?.language ?? null,
      code: s?.code ?? null,
    };
  });

  return {
    participant: reviewParticipant,
    submission: {
      id: submissionRow.id,
      lockedAt: submissionRow.lockedAt,
      reason: submissionRow.reason,
      createdAt: submissionRow.createdAt,
    },
    snippets,
    violations: reviewViolations,
  };
}
