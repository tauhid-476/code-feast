CREATE TABLE "approved_organizers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "e2b_api_key" text;--> statement-breakpoint
ALTER TABLE "runner_pool" ADD COLUMN "event_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "approved_organizers_email_unique" ON "approved_organizers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "approved_organizers_email_lower_idx" ON "approved_organizers" USING btree (lower("email"));--> statement-breakpoint
ALTER TABLE "runner_pool" ADD CONSTRAINT "runner_pool_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runner_pool_event_idx" ON "runner_pool" USING btree ("event_id");