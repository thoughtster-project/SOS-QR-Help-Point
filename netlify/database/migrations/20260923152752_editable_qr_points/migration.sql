CREATE TABLE "qr_points" (
	"id" text PRIMARY KEY,
	"bus" text NOT NULL,
	"name" text NOT NULL,
	"zone" text NOT NULL,
	"seat" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ALTER COLUMN "seat" SET DATA TYPE text USING "seat"::text;