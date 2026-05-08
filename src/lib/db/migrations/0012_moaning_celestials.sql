CREATE TABLE "curated_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" text NOT NULL,
	"display_name" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"intelligence_level" integer DEFAULT 3 NOT NULL,
	"cost_level" integer DEFAULT 2 NOT NULL,
	"category" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curated_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE INDEX "curated_models_sort_order_idx" ON "curated_models" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "curated_models_enabled_idx" ON "curated_models" USING btree ("enabled");