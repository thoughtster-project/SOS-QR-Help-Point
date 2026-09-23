var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// netlify/functions/log-event.mts
import { eq } from "drizzle-orm";

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

// netlify/functions/log-event.mts
var allowedEvents = /* @__PURE__ */ new Set([
  "sos",
  "police_request",
  "driver_ack",
  "driver_resolved_self",
  "driver_police_started",
  "driver_calling_done",
  "unit_arriving",
  "case_closed",
  "reporter_closed"
]);
var log_event_default = async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.json();
    const caseId = typeof body.caseId === "string" ? body.caseId.slice(0, 40) : "";
    const eventType = typeof body.type === "string" ? body.type : "";
    const actor = typeof body.from === "string" ? body.from.slice(0, 24) : "unknown";
    if (!caseId || !allowedEvents.has(eventType)) return Response.json({ error: "Invalid event" }, { status: 400 });
    const occurredAt = new Date(typeof body.ts === "number" ? body.ts : Date.now());
    const base = {
      caseId,
      reporterType: eventType === "sos" ? actor : "unknown",
      bus: typeof body.bus === "string" ? body.bus.slice(0, 40) : null,
      pointId: typeof body.pointId === "string" ? body.pointId.slice(0, 64) : null,
      pointName: typeof body.pointName === "string" ? body.pointName.slice(0, 100) : null,
      zone: typeof body.zone === "string" ? body.zone.slice(0, 80) : null,
      seat: typeof body.seat === "string" || typeof body.seat === "number" ? String(body.seat).slice(0, 40) : null,
      details: typeof body.details === "string" ? body.details.slice(0, 4e3) : "",
      tags: Array.isArray(body.tags) ? body.tags.filter((v) => typeof v === "string").slice(0, 20) : [],
      reportedAt: occurredAt,
      updatedAt: occurredAt
    };
    await db.insert(incidents).values(base).onConflictDoNothing({ target: incidents.caseId });
    if (eventType === "sos") {
      await db.update(incidents).set({
        reporterType: actor,
        bus: base.bus,
        pointId: base.pointId,
        pointName: base.pointName,
        zone: base.zone,
        seat: base.seat,
        details: base.details,
        tags: base.tags,
        reportedAt: occurredAt
      }).where(eq(incidents.caseId, caseId));
    } else if (eventType === "police_request") {
      await db.update(incidents).set({ policeRequested: true, updatedAt: occurredAt }).where(eq(incidents.caseId, caseId));
    } else if (eventType === "driver_ack") {
      await db.update(incidents).set({ status: "acknowledged", acknowledgedAt: occurredAt, updatedAt: occurredAt }).where(eq(incidents.caseId, caseId));
    } else if (eventType === "driver_resolved_self") {
      await db.update(incidents).set({ resolution: "resolved_by_driver", updatedAt: occurredAt }).where(eq(incidents.caseId, caseId));
    } else if (eventType === "driver_police_started" || eventType === "driver_calling_done") {
      await db.update(incidents).set({ policeCalled: true, resolution: "police_contacted", updatedAt: occurredAt }).where(eq(incidents.caseId, caseId));
    } else if (eventType === "case_closed") {
      const reason = typeof body.reason === "string" ? body.reason.slice(0, 120) : null;
      await db.update(incidents).set({ status: "closed", resolution: reason || void 0, closedAt: occurredAt, updatedAt: occurredAt }).where(eq(incidents.caseId, caseId));
    } else if (eventType === "reporter_closed") {
    }
    const payload = Object.fromEntries(Object.entries(body).filter(([key]) => !["type", "from", "caseId", "ts"].includes(key)));
    await db.insert(incidentEvents).values({ caseId, eventType, actor, payload, occurredAt });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to store incident event", error);
    return Response.json({ error: "Unable to store event" }, { status: 500 });
  }
};

// api/log-event.mjs
var log_event_default2 = { fetch: log_event_default };
export {
  log_event_default2 as default
};
