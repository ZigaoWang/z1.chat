ALTER TABLE "credit_transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(20, 10);--> statement-breakpoint
ALTER TABLE "credit_transactions" ALTER COLUMN "balance" SET DATA TYPE numeric(20, 10);--> statement-breakpoint
ALTER TABLE "invite_tokens" ALTER COLUMN "credit_amount" SET DATA TYPE numeric(20, 10);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "cost" SET DATA TYPE numeric(20, 10);--> statement-breakpoint
ALTER TABLE "usage_logs" ALTER COLUMN "cost_usd" SET DATA TYPE numeric(20, 10);--> statement-breakpoint
ALTER TABLE "usage_logs" ALTER COLUMN "cost_usd" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "usage_logs" ALTER COLUMN "user_cost_usd" SET DATA TYPE numeric(20, 10);--> statement-breakpoint
ALTER TABLE "usage_logs" ALTER COLUMN "user_cost_usd" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "credit_balance" SET DATA TYPE numeric(20, 10);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "credit_balance" SET DEFAULT '0';