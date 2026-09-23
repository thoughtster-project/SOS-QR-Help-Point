var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// netlify/functions/active-incidents.mts
import { and, asc, inArray, eq } from "drizzle-orm";

// db/index.ts
import { drizzle } from "drizzle-orm/neon-http";

// db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  incidentEvents: () => incidentEvents,
  incidents: () => incidents,
  qrPoints: () => qrPoints
});
import { boolean, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
var incidents = pgTable("incidents", {
  caseId: text("case_id").primaryKey(),
  reporterType: text("reporter_type").notNull().default("unknown"),
  bus: text("bus"),
  pointId: text("point_id"),
  pointName: text("point_name"),
  zone: text("zone"),
  seat: text("seat"),
  details: text("details").notNull().default(""),
  tags: jsonb("tags").$type().notNull().default([]),
  status: text("status").notNull().default("open"),
  policeRequested: boolean("police_requested").notNull().default(false),
  policeCalled: boolean("police_called").notNull().default(false),
  resolution: text("resolution"),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
var incidentEvents = pgTable("incident_events", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  payload: jsonb("payload").$type().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  sourceEventId: text("source_event_id").unique()
});
var qrPoints = pgTable("qr_points", {
  id: text("id").primaryKey(),
  bus: text("bus").notNull(),
  name: text("name").notNull(),
  zone: text("zone").notNull(),
  seat: text("seat"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

// db/index.ts
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
var db = drizzle(databaseUrl, { schema: schema_exports });

// netlify/functions/active-incidents.mts
var active_incidents_default = async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  try {
    const bus = new URL(req.url).searchParams.get("bus")?.trim().slice(0, 40);
    const active = inArray(incidents.status, ["open", "acknowledged"]);
    const cases = await db.select().from(incidents).where(bus ? and(eq(incidents.bus, bus), active) : active).orderBy(asc(incidents.reportedAt)).limit(200);
    return Response.json({ cases }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load active incidents", error);
    return Response.json({ error: "Unable to load cases" }, { status: 500 });
  }
};

// api/active-incidents.mjs
var active_incidents_default2 = { fetch: active_incidents_default };
export {
  active_incidents_default2 as default
};
