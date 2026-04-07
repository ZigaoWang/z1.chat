ALTER TABLE "conversations" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "summary_message_count" integer DEFAULT 0;