import type { Config } from "@netlify/functions";
import { timingSafeEqual } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { qrPoints } from "../../db/schema.js";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (req.method === "GET") {
      if (id) {
        const [point] = await db.select().from(qrPoints).where(eq(qrPoints.id, id)).limit(1);
        return point && point.active
          ? Response.json({ point })
          : Response.json({ error: "Point not found" }, { status: 404 });
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

    const body = await req.json() as Record<string, unknown>;
    const bus = clean(body.bus, 40);
    const name = clean(body.name, 100);
    const zone = clean(body.zone, 80);
    const seat = clean(body.seat, 40) || null;
    if (!bus || !name || !zone) {
      return Response.json({ error: "Bus, point name and zone are required" }, { status: 400 });
    }

    if (req.method === "POST") {
      const point = {
        id: crypto.randomUUID(), bus, name, zone, seat,
      };
      await db.insert(qrPoints).values(point);
      return Response.json({ point }, { status: 201 });
    }

    const pointId = clean(body.id, 64);
    if (!pointId) return Response.json({ error: "Point ID is required" }, { status: 400 });
    const [point] = await db.update(qrPoints)
      .set({ bus, name, zone, seat, active: body.active !== false, updatedAt: new Date() })
      .where(eq(qrPoints.id, pointId)).returning();
    return point
      ? Response.json({ point })
      : Response.json({ error: "Point not found" }, { status: 404 });
  } catch (error) {
    console.error("Unable to manage QR points", error);
    return Response.json({ error: "Unable to manage QR points" }, { status: 500 });
  }
};

export const config: Config = { path: "/api/qr-points" };
