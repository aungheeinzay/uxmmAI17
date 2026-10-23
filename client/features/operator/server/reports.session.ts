import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { reportOverviewSchema, reportQuerySchema } from "../types/report.types";

export function reportsOverviewSession(request: NextRequest) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 4096) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const input = reportQuerySchema.safeParse(body);
    if (!input.success) throw new SessionError(400, "VALIDATION_ERROR");
    const params = new URLSearchParams(input.data);
    const payload = await expressAuth(`/api/operator/reports/overview?${params}`, undefined, accessToken);
    const result = z.object({ success: z.literal(true), data: reportOverviewSchema }).safeParse(payload);
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    return result.data;
  });
}
