import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { assignmentSchema, assignmentDetailSchema, assignmentListSchema, eligibleRidersSchema, createAssignmentSchema, deliveryQuerySchema, parcelScanRequestSchema, riderAssignmentListSchema, riderDeliveryQuerySchema, statusRequestSchema } from "../types/delivery.types";
type Operation = "riders" | "operatorList" | "create" | "riderList" | "detail" | "status" | "scan";
export function deliveriesSession(request: NextRequest, operation: Operation) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    const rider = ["riderList", "detail", "status", "scan"].includes(operation);
    if (user.role !== (rider ? "RIDER" : "OPERATOR")) throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    let path: string, input: unknown = undefined, method: "PATCH" | undefined;
    const responseSchema = operation === "riders" ? eligibleRidersSchema : operation === "create" ? assignmentSchema
      : operation === "detail" ? assignmentDetailSchema : operation === "status" ? assignmentDetailSchema.extend({ previousStatus: z.string() })
      : operation === "scan" ? assignmentDetailSchema
      : operation === "riderList" ? riderAssignmentListSchema : assignmentListSchema;
    if (operation === "scan") {
      const parsed = parcelScanRequestSchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      input = parsed.data; path = "/api/rider/parcel-scans/verify";
    } else if (operation === "create") {
      const parsed = createAssignmentSchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      input = parsed.data; path = "/api/operator/assignments";
    } else if (operation === "detail" || operation === "status") {
      const parsed = (operation === "detail" ? z.object({ id: z.string().uuid() }).strict() : statusRequestSchema).safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      path = `/api/rider/assignments/${parsed.data.id}${operation === "status" ? "/status" : ""}`;
      if (operation === "status") {
        const status = statusRequestSchema.parse(body);
        input = { status: status.status, ...(status.note ? { note: status.note } : {}) }; method = "PATCH";
      }
    } else if (operation === "riderList") {
      const parsed = riderDeliveryQuerySchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      const params = new URLSearchParams({ page: String(parsed.data.page), pageSize: String(parsed.data.pageSize) });
      if (parsed.data.group) params.set("group", parsed.data.group);
      if (parsed.data.status) params.set("status", parsed.data.status);
      path = `/api/rider/assignments?${params}`;
    } else {
      const parsed = deliveryQuerySchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      path = `${operation === "riders" ? "/api/operator/riders" : "/api/operator/assignments"}?page=${parsed.data.page}&pageSize=${parsed.data.pageSize}`;
      if (operation === "riders") path += "&eligible=true";
    }
    const result = z.object({ success: z.literal(true), data: responseSchema }).safeParse(await expressAuth(path, input, accessToken, method));
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    if (rider) {
      const data = result.data.data;
      if ("assignments" in data ? data.assignments.some(item => item.riderId !== user.id) : !("riderId" in data) || data.riderId !== user.id) throw new SessionError(502, "INVALID_RESPONSE");
      if ((operation === "detail" || operation === "status") && "id" in data && typeof body === "object" && body && "id" in body && data.id !== body.id) throw new SessionError(502, "INVALID_RESPONSE");
    }
    return result.data;
  });
}
