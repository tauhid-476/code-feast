ALTER TABLE "participants" ADD COLUMN "run_in_flight_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "last_run_at" timestamp with time zone;