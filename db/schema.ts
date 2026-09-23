import { boolean, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const incidents = pgTable("incidents", {
  caseId: text("case_id").primaryKey(),
  reporterType: text("reporter_type").notNull().default("unknown"),
  bus: text("bus"),
  pointId: text("point_id"),
  pointName: text("point_name"),
  zone: text("zone"),
  seat: text("seat"),
  details: text("details").notNull().default(""),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("open"),
  policeRequested: boolean("police_requested").notNull().default(false),
  policeCalled: boolean("police_called").notNull().default(false),
  resolution: text("resolution"),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const incidentEvents = pgTable("incident_events", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const qrPoints = pgTable("qr_points", {
  id: text("id").primaryKey(),
  bus: text("bus").notNull(),
  name: text("name").notNull(),
  zone: text("zone").notNull(),
  seat: text("seat"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
