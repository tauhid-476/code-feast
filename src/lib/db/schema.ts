import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The whole data model from SPEC.md §8, plus `runner_pool` from §7.
 *
 * Status columns are text with check constraints rather than pg enums so that a
 * migration can widen a vocabulary without an enum rewrite.
 */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull().default("draft"),
    durationMinutes: integer("duration_minutes").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    e2bApiKey: text("e2b_api_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("events_status_check", sql`${t.status} in ('draft', 'live', 'ended')`),
    check("events_duration_check", sql`${t.durationMinutes} > 0`),
    // A join code is unique among non-ended events; ended codes may be reused.
    uniqueIndex("events_live_code_unique")
      .on(t.code)
      .where(sql`status <> 'ended'`),
    index("events_created_by_idx").on(t.createdBy),
    index("events_status_idx").on(t.status),
  ],
);

export const problems = pgTable(
  "problems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    difficulty: text("difficulty"),
    statementMd: text("statement_md").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("problems_event_position_idx").on(t.eventId, t.position)],
);

export const problemStarters = pgTable(
  "problem_starters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    starterCode: text("starter_code").notNull(),
    harnessCode: text("harness_code").notNull(),
  },
  (t) => [
    uniqueIndex("problem_starters_problem_language_unique").on(
      t.problemId,
      t.language,
    ),
    check(
      "problem_starters_language_check",
      sql`${t.language} in ('python', 'java', 'cpp')`,
    ),
  ],
);

export const testCases = pgTable(
  "test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    input: text("input").notNull(),
    expectedOutput: text("expected_output").notNull(),
  },
  (t) => [
    uniqueIndex("test_cases_problem_position_unique").on(
      t.problemId,
      t.position,
    ),
    check("test_cases_position_check", sql`${t.position} in (1, 2)`),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    status: text("status").notNull().default("joined"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockoutReason: text("lockout_reason"),
    strikes: integer("strikes").notNull().default(0),
    shortlisted: boolean("shortlisted").notNull().default(false),
    activeSessionId: text("active_session_id"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    // Run rate limiting (ticket 10): which Run is in flight, and when the last
    // one finished. Operational state, not a record of what was run.
    runInFlightAt: timestamp("run_in_flight_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("participants_event_user_unique").on(t.eventId, t.userId),
    index("participants_event_idx").on(t.eventId),
    check(
      "participants_status_check",
      sql`${t.status} in ('joined', 'solving', 'locked_out')`,
    ),
    check(
      "participants_lockout_reason_check",
      sql`${t.lockoutReason} is null or ${t.lockoutReason} in ('submitted', 'deadline', 'eliminated')`,
    ),
    check("participants_strikes_check", sql`${t.strikes} >= 0`),
  ],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    code: text("code").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("drafts_participant_problem_language_unique").on(
      t.participantId,
      t.problemId,
      t.language,
    ),
    check(
      "drafts_language_check",
      sql`${t.language} in ('python', 'java', 'cpp')`,
    ),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("submissions_participant_unique").on(t.participantId),
    check(
      "submissions_reason_check",
      sql`${t.reason} in ('submitted', 'deadline', 'eliminated')`,
    ),
  ],
);

export const submissionSnippets = pgTable(
  "submission_snippets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    problemId: uuid("problem_id")
      .notNull()
      .references(() => problems.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    code: text("code").notNull(),
  },
  (t) => [
    uniqueIndex("submission_snippets_submission_problem_unique").on(
      t.submissionId,
      t.problemId,
    ),
    check(
      "submission_snippets_language_check",
      sql`${t.language} in ('python', 'java', 'cpp')`,
    ),
  ],
);

export const violations = pgTable(
  "violations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    counted: boolean("counted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("violations_participant_idx").on(t.participantId, t.createdAt),
    check(
      "violations_kind_check",
      sql`${t.kind} in ('fullscreen_exit', 'focus_lost', 'duplicate_session', 'paste_blocked', 'context_menu_blocked')`,
    ),
  ],
);

export const runnerPool = pgTable(
  "runner_pool",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
    sandboxId: text("sandbox_id").notNull(),
    state: text("state").notNull().default("ready"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastHealthAt: timestamp("last_health_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("runner_pool_sandbox_unique").on(t.sandboxId),
    index("runner_pool_state_idx").on(t.state),
    index("runner_pool_event_idx").on(t.eventId),
    check(
      "runner_pool_state_check",
      sql`${t.state} in ('ready', 'claimed', 'dead')`,
    ),
  ],
);

export const approvedOrganizers = pgTable(
  "approved_organizers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("approved_organizers_email_unique").on(t.email),
    index("approved_organizers_email_lower_idx").on(sql`lower(${t.email})`),
  ],
);

export const schema = {
  events,
  problems,
  problemStarters,
  testCases,
  participants,
  drafts,
  submissions,
  submissionSnippets,
  violations,
  runnerPool,
  approvedOrganizers,
};
