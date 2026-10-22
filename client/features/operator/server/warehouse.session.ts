import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { warehouseListSchema, warehouseOverviewSchema, warehouseQuerySchema, warehouseSearchParams } from "../types/warehouse.types";
export function warehouseSession(request: NextRequest, list = false) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const input = (list ? warehouseQuerySchema : z.object({}).strict()).safeParse(body);
    if (!input.success) throw new SessionError(400, "VALIDATION_ERROR");
    const path = list ? `/api/operator/warehouse/parcels?${warehouseSearchParams(warehouseQuerySchema.parse(input.data))}` : "/api/operator/warehouse/overview";
    const result = z.object({ success: z.literal(true), data: list ? warehouseListSchema : warehouseOverviewSchema }).safeParse(await expressAuth(path, undefined, accessToken));
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    return result.data;
  });
}
