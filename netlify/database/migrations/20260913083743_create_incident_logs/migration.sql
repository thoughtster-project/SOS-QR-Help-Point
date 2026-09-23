CREATE TABLE "incident_events" (
	"id" serial PRIMARY KEY,
	"case_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"case_id" text PRIMARY KEY,
	"reporter_type" text DEFAULT 'unknown' NOT NULL,
	"bus" text,
	"zone" text,
	"seat" integer,
	"details" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"police_requested" boolean DEFAULT false NOT NULL,
	"police_called" boolean DEFAULT false NOT NULL,
	"resolution" text,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
