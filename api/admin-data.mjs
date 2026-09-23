var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// netlify/functions/admin-data.mts
import { and, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";

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

// netlify/functions/admin-data.mts
var admin_data_default = async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  try {
    const url = new URL(req.url);
    const filters = [];
    const reporter = url.searchParams.get("reporter");
    const status = url.searchParams.get("status");
    const response = url.searchParams.get("response");
    const query = url.searchParams.get("q")?.trim();
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (reporter && reporter !== "all") filters.push(eq(incidents.reporterType, reporter));
    if (status && status !== "all") filters.push(eq(incidents.status, status));
    if (response === "police") filters.push(eq(incidents.policeCalled, true));
    if (response === "self") filters.push(eq(incidents.resolution, "resolved_by_driver"));
    if (response === "requested") filters.push(eq(incidents.policeRequested, true));
    if (query) filters.push(ilike(incidents.caseId, `%${query.slice(0, 40)}%`));
    if (from) filters.push(gte(incidents.reportedAt, /* @__PURE__ */ new Date(`${from}T00:00:00+07:00`)));
    if (to) filters.push(lte(incidents.reportedAt, /* @__PURE__ */ new Date(`${to}T23:59:59+07:00`)));
    const rows = await db.select().from(incidents).where(filters.length ? and(...filters) : void 0).orderBy(desc(incidents.reportedAt)).limit(250);
    const ids = rows.map((row) => row.caseId);
    const events = ids.length ? await db.select().from(incidentEvents).where(inArray(incidentEvents.caseId, ids)).orderBy(desc(incidentEvents.occurredAt)).limit(1500) : [];
    const todayStart = /* @__PURE__ */ new Date();
    todayStart.setUTCHours(17, 0, 0, 0);
    if (todayStart > /* @__PURE__ */ new Date()) todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    const today = rows.filter((row) => row.reportedAt >= todayStart);
    const summary = {
      total: rows.length,
      today: today.length,
      open: rows.filter((row) => row.status === "open" || row.status === "acknowledged").length,
      passengers: rows.filter((row) => row.reporterType === "passenger").length,
      bystanders: rows.filter((row) => row.reporterType === "bystander").length,
      policeCalled: rows.filter((row) => row.policeCalled).length,
      policeAfterRequest: rows.filter((row) => row.policeCalled && row.policeRequested).length,
      resolvedByDriver: rows.filter((row) => row.resolution === "resolved_by_driver").length,
      abandoned: rows.filter((row) => row.status === "abandoned").length,
      averageAckSeconds: Math.round(rows.filter((row) => row.acknowledgedAt).reduce((sum, row) => sum + (row.acknowledgedAt.getTime() - row.reportedAt.getTime()) / 1e3, 0) / (rows.filter((row) => row.acknowledgedAt).length || 1))
    };
    return Response.json({ incidents: rows, events, summary, refreshedAt: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (error) {
    console.error("Unable to load admin data", error);
    return Response.json({ error: "Unable to load dashboard" }, { status: 500 });
  }
};

// api/admin-data.mjs
var admin_data_default2 = { fetch: admin_data_default };
export {
  admin_data_default2 as default
};
