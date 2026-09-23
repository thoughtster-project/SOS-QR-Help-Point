var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// netlify/functions/qr-points.mts
import { timingSafeEqual } from "node:crypto";
import { asc, eq } from "drizzle-orm";

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

// netlify/functions/qr-points.mts
function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
var qr_points_default = async (req) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (req.method === "GET") {
      if (id) {
        const [point2] = await db.select().from(qrPoints).where(eq(qrPoints.id, id)).limit(1);
        return point2 && point2.active ? Response.json({ point: point2 }) : Response.json({ error: "Point not found" }, { status: 404 });
      }
      const points = await db.select().from(qrPoints).orderBy(asc(qrPoints.createdAt));
      return Response.json({ points });
    }
    if (req.method !== "POST" && req.method !== "PATCH") {
      return new Response("Method not allowed", { status: 405 });
    }
    const configuredKey = process.env.QR_ADMIN_KEY;
    if (!configuredKey) return Response.json({ error: "QR_ADMIN_KEY is not configured" }, { status: 503 });
    const suppliedKey = req.headers.get("X-QR-Admin-Key") || "";
    const expected = Buffer.from(configuredKey);
    const supplied = Buffer.from(suppliedKey);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return Response.json({ error: "Invalid admin key" }, { status: 401 });
    }
    const body = await req.json();
    const bus = clean(body.bus, 40);
    const name = clean(body.name, 100);
    const zone = clean(body.zone, 80);
    const seat = clean(body.seat, 40) || null;
    if (!bus || !name || !zone) {
      return Response.json({ error: "Bus, point name and zone are required" }, { status: 400 });
    }
    if (req.method === "POST") {
      const point2 = {
        id: crypto.randomUUID(),
        bus,
        name,
        zone,
        seat
      };
      await db.insert(qrPoints).values(point2);
      return Response.json({ point: point2 }, { status: 201 });
    }
    const pointId = clean(body.id, 64);
    if (!pointId) return Response.json({ error: "Point ID is required" }, { status: 400 });
    const [point] = await db.update(qrPoints).set({ bus, name, zone, seat, active: body.active !== false, updatedAt: /* @__PURE__ */ new Date() }).where(eq(qrPoints.id, pointId)).returning();
    return point ? Response.json({ point }) : Response.json({ error: "Point not found" }, { status: 404 });
  } catch (error) {
    console.error("Unable to manage QR points", error);
    return Response.json({ error: "Unable to manage QR points" }, { status: 500 });
  }
};

// api/qr-points.mjs
var qr_points_default2 = { fetch: qr_points_default };
export {
  qr_points_default2 as default
};
