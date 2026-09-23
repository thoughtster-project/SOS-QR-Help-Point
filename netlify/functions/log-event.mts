import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { incidentEvents, incidents } from "../../db/schema.js";

const allowedEvents = new Set([
  "sos", "police_request", "driver_ack", "driver_resolved_self", "driver_police_started",
  "driver_calling_done", "unit_arriving", "case_closed", "reporter_closed",
]);

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json() as Record<string, unknown>;
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
      details: typeof body.details === "string" ? body.details.slice(0, 4000) : "",
      tags: Array.isArray(body.tags) ? body.tags.filter(v => typeof v === "string").slice(0, 20) as string[] : [],
      reportedAt: occurredAt,
      updatedAt: occurredAt,
    };

    await db.insert(incidents).values(base).onConflictDoNothing({ target: incidents.caseId });

    if (eventType === "sos") {
      await db.update(incidents).set({
        reporterType: actor, bus: base.bus, pointId: base.pointId, pointName: base.pointName,
        zone: base.zone, seat: base.seat, details: base.details, tags: base.tags,
        reportedAt: occurredAt,
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
      await db.update(incidents).set({ status: "closed", resolution: reason || undefined, closedAt: occurredAt, updatedAt: occurredAt }).where(eq(incidents.caseId, caseId));
    } else if (eventType === "reporter_closed") {
      // The reporter leaving the page does not mean the emergency is resolved.
    }

    const payload = Object.fromEntries(Object.entries(body).filter(([key]) => !["type", "from", "caseId", "ts"].includes(key)));
    await db.insert(incidentEvents).values({ caseId, eventType, actor, payload, occurredAt });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to store incident event", error);
    return Response.json({ error: "Unable to store event" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/log-event" };
