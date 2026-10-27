CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"language" text NOT NULL,
	"code" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drafts_language_check" CHECK ("drafts"."language" in ('python', 'java', 'cpp'))
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"starts_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_status_check" CHECK ("events"."status" in ('draft', 'live', 'ended')),
	CONSTRAINT "events_duration_check" CHECK ("events"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'joined' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"lockout_reason" text,
	"strikes" integer DEFAULT 0 NOT NULL,
	"shortlisted" boolean DEFAULT false NOT NULL,
	"active_session_id" text,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "participants_status_check" CHECK ("participants"."status" in ('joined', 'solving', 'locked_out')),
	CONSTRAINT "participants_lockout_reason_check" CHECK ("participants"."lockout_reason" is null or "participants"."lockout_reason" in ('submitted', 'deadline', 'eliminated')),
	CONSTRAINT "participants_strikes_check" CHECK ("participants"."strikes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "problem_starters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"language" text NOT NULL,
	"starter_code" text NOT NULL,
	"harness_code" text NOT NULL,
	CONSTRAINT "problem_starters_language_check" CHECK ("problem_starters"."language" in ('python', 'java', 'cpp'))
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"difficulty" text,
	"statement_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runner_pool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sandbox_id" text NOT NULL,
	"state" text DEFAULT 'ready' NOT NULL,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_health_at" timestamp with time zone,
	CONSTRAINT "runner_pool_state_check" CHECK ("runner_pool"."state" in ('ready', 'claimed', 'dead'))
);
--> statement-breakpoint
CREATE TABLE "submission_snippets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"language" text NOT NULL,
	"code" text NOT NULL,
	CONSTRAINT "submission_snippets_language_check" CHECK ("submission_snippets"."language" in ('python', 'java', 'cpp'))
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"locked_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_reason_check" CHECK ("submissions"."reason" in ('submitted', 'deadline', 'eliminated'))
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"input" text NOT NULL,
	"expected_output" text NOT NULL,
	CONSTRAINT "test_cases_position_check" CHECK ("test_cases"."position" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"counted" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "violations_kind_check" CHECK ("violations"."kind" in ('fullscreen_exit', 'focus_lost', 'duplicate_session', 'paste_blocked', 'context_menu_blocked'))
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_starters" ADD CONSTRAINT "problem_starters_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_snippets" ADD CONSTRAINT "submission_snippets_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_snippets" ADD CONSTRAINT "submission_snippets_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "violations" ADD CONSTRAINT "violations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_participant_problem_language_unique" ON "drafts" USING btree ("participant_id","problem_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "events_live_code_unique" ON "events" USING btree ("code") WHERE status <> 'ended';--> statement-breakpoint
CREATE INDEX "events_created_by_idx" ON "events" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_event_user_unique" ON "participants" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "participants_event_idx" ON "participants" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "problem_starters_problem_language_unique" ON "problem_starters" USING btree ("problem_id","language");--> statement-breakpoint
CREATE INDEX "problems_event_position_idx" ON "problems" USING btree ("event_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "runner_pool_sandbox_unique" ON "runner_pool" USING btree ("sandbox_id");--> statement-breakpoint
CREATE INDEX "runner_pool_state_idx" ON "runner_pool" USING btree ("state");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_snippets_submission_problem_unique" ON "submission_snippets" USING btree ("submission_id","problem_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_participant_unique" ON "submissions" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "test_cases_problem_position_unique" ON "test_cases" USING btree ("problem_id","position");--> statement-breakpoint
CREATE INDEX "violations_participant_idx" ON "violations" USING btree ("participant_id","created_at");