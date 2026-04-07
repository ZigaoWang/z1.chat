ALTER TABLE "users" ALTER COLUMN "preferences" SET DEFAULT '{"theme":"system","defaultModel":null,"responseStyle":"balanced","language":null,"customInstructions":null}'::jsonb;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "access_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "last_accessed_at" timestamp with time zone;