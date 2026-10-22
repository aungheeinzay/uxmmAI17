import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { operatorOrderDetailSchema, operatorOrderListSchema, operatorOrdersQuerySchema, ordersSearchParams } from "../types/operator-order.types";
import { receivedOperatorOrderSchema } from "../types/operator-order.types";

export function receiveParcelSession(request: NextRequest) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const input = z.object({ id: z.string().uuid() }).strict().safeParse(body);
    if (!input.success) throw new SessionError(400, "VALIDATION_ERROR");
    const payload = await expressAuth(`/api/operator/orders/${input.data.id}/receive`, {}, accessToken, "PATCH");
    const result = z.object({ success: z.literal(true), data: receivedOperatorOrderSchema }).safeParse(payload);
    if (!result.success || result.data.data.id !== input.data.id) throw new SessionError(502, "INVALID_RESPONSE");
    return result.data;
  });
}

export function operatorOrdersSession(request: NextRequest, detail = false) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const input = (detail ? z.object({ id: z.string().uuid() }).strict() : operatorOrdersQuerySchema).safeParse(body);
    if (!input.success) throw new SessionError(400, "VALIDATION_ERROR");
    const path = "id" in input.data ? `/api/operator/orders/${input.data.id}`
      : `/api/operator/orders?${ordersSearchParams(input.data)}`;
    let payload: unknown;
    try { payload = await expressAuth(path, undefined, accessToken); }
    catch (error) {
      if (error instanceof SessionError && error.status === 404) throw new SessionError(404, "ORDER_NOT_FOUND");
      throw error;
    }
    const result = z.object({ success: z.literal(true), data: detail ? operatorOrderDetailSchema : operatorOrderListSchema }).safeParse(payload);
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    return result.data;
  });
}
