ALTER TABLE "usage_logs" ADD COLUMN "user_cost_usd" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "credit_balance" real DEFAULT 0 NOT NULL;