import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { incidentListSchema, incidentQuerySchema, incidentSchema, reportIncidentSchema, reviewIncidentSchema } from "../types/incident.types";

type Operation = "create" | "riderList" | "riderDetail" | "operatorList" | "operatorDetail" | "review";

// BFF boundary: the browser only ever sends data the Rider controls. The Order,
// Rider and provider are resolved by Express from the authenticated session.
export function incidentsSession(request: NextRequest, operation: Operation) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    const rider = operation === "create" || operation === "riderList" || operation === "riderDetail";
    if (user.role !== (rider ? "RIDER" : "OPERATOR")) throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }

    let path: string;
    let input: unknown = undefined;
    let method: "PATCH" | undefined;
    if (operation === "create") {
      const parsed = reportIncidentSchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      input = parsed.data; path = "/api/rider/incidents";
    } else if (operation === "review") {
      const parsed = reviewIncidentSchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      path = `/api/operator/incidents/${parsed.data.id}/review`; input = { status: parsed.data.status }; method = "PATCH";
    } else if (operation === "riderDetail" || operation === "operatorDetail") {
      const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      path = `${rider ? "/api/rider/incidents" : "/api/operator/incidents"}/${parsed.data.id}`;
    } else {
      const parsed = incidentQuerySchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      const params = new URLSearchParams({ page: String(parsed.data.page), pageSize: String(parsed.data.pageSize) });
      if (parsed.data.status) params.set("status", parsed.data.status);
      path = `${rider ? "/api/rider/incidents" : "/api/operator/incidents"}?${params.toString()}`;
    }

    const responseSchema = operation === "riderList" || operation === "operatorList" ? incidentListSchema : incidentSchema;
    const result = z.object({ success: z.literal(true), data: responseSchema }).safeParse(await expressAuth(path, input, accessToken, method));
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    if (rider) {
      const data = result.data.data;
      const own = "incidents" in data ? data.incidents.every(item => item.riderId === user.id) : data.riderId === user.id;
      if (!own) throw new SessionError(502, "INVALID_RESPONSE");
    }
    return result.data;
  });
}
