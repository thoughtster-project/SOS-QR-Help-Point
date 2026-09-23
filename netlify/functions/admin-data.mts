import type { Config } from "@netlify/functions";
import { and, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { incidentEvents, incidents } from "../../db/schema.js";

export default async (req: Request) => {
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
    if (from) filters.push(gte(incidents.reportedAt, new Date(`${from}T00:00:00+07:00`)));
    if (to) filters.push(lte(incidents.reportedAt, new Date(`${to}T23:59:59+07:00`)));

    const rows = await db.select().from(incidents)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(incidents.reportedAt)).limit(250);
    const ids = rows.map(row => row.caseId);
    const events = ids.length ? await db.select().from(incidentEvents)
      .where(inArray(incidentEvents.caseId, ids)).orderBy(desc(incidentEvents.occurredAt)).limit(1500) : [];

    const todayStart = new Date();
    todayStart.setUTCHours(17, 0, 0, 0);
    if (todayStart > new Date()) todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    const today = rows.filter(row => row.reportedAt >= todayStart);
    const summary = {
      total: rows.length,
      today: today.length,
      open: rows.filter(row => row.status === "open" || row.status === "acknowledged").length,
      passengers: rows.filter(row => row.reporterType === "passenger").length,
      bystanders: rows.filter(row => row.reporterType === "bystander").length,
      policeCalled: rows.filter(row => row.policeCalled).length,
      policeAfterRequest: rows.filter(row => row.policeCalled && row.policeRequested).length,
      resolvedByDriver: rows.filter(row => row.resolution === "resolved_by_driver").length,
      abandoned: rows.filter(row => row.status === "abandoned").length,
      averageAckSeconds: Math.round(rows.filter(row => row.acknowledgedAt).reduce((sum, row) => sum + ((row.acknowledgedAt!.getTime() - row.reportedAt.getTime()) / 1000), 0) / (rows.filter(row => row.acknowledgedAt).length || 1)),
    };
    return Response.json({ incidents: rows, events, summary, refreshedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Unable to load admin data", error);
    return Response.json({ error: "Unable to load dashboard" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/admin-data" };
