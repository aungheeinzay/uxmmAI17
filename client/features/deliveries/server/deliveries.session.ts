import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { assignmentSchema, assignmentDetailSchema, assignmentListSchema, eligibleRidersSchema, createAssignmentSchema, deliveryQuerySchema, statusRequestSchema } from "../types/delivery.types";
type Operation = "riders" | "operatorList" | "create" | "riderList" | "detail" | "status";
export function deliveriesSession(request: NextRequest, operation: Operation) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    const rider = ["riderList", "detail", "status"].includes(operation);
    if (user.role !== (rider ? "RIDER" : "OPERATOR")) throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    let path: string, input: unknown = undefined, method: "PATCH" | undefined;
    const responseSchema = operation === "riders" ? eligibleRidersSchema : operation === "create" ? assignmentSchema
      : operation === "detail" ? assignmentDetailSchema : operation === "status" ? assignmentDetailSchema.extend({ previousStatus: z.string() }) : assignmentListSchema;
    if (operation === "create") {
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
    } else {
      const parsed = deliveryQuerySchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      path = `${operation === "riders" ? "/api/operator/riders" : rider ? "/api/rider/assignments" : "/api/operator/assignments"}?page=${parsed.data.page}&pageSize=${parsed.data.pageSize}`;
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
