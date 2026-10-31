CREATE TABLE "problem_figures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"state" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "problem_figures_state_check" CHECK ("problem_figures"."state" in ('pending', 'ready')),
	CONSTRAINT "problem_figures_content_type_check" CHECK ("problem_figures"."content_type" in ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "problem_figures_bytes_check" CHECK ("problem_figures"."bytes" between 1 and 2097152)
);
--> statement-breakpoint
ALTER TABLE "problem_figures" ADD CONSTRAINT "problem_figures_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "problem_figures_storage_key_unique" ON "problem_figures" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "problem_figures_problem_state_idx" ON "problem_figures" USING btree ("problem_id","state");--> statement-breakpoint
CREATE INDEX "problem_figures_state_created_idx" ON "problem_figures" USING btree ("state","created_at");