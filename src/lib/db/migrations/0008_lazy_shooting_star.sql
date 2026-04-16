ALTER TABLE "messages" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "branch_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "messages_parent_id_idx" ON "messages" USING btree ("parent_id");