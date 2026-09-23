import type { Config } from "@netlify/functions";
import { and, asc, inArray, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { incidents } from "../../db/schema.js";

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  try {
    const bus = new URL(req.url).searchParams.get("bus")?.trim().slice(0, 40);
    const active = inArray(incidents.status, ["open", "acknowledged"]);
    const cases = await db.select().from(incidents)
      .where(bus ? and(eq(incidents.bus, bus), active) : active)
      .orderBy(asc(incidents.reportedAt)).limit(200);
    return Response.json({ cases }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load active incidents", error);
    return Response.json({ error: "Unable to load cases" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/active-incidents" };
