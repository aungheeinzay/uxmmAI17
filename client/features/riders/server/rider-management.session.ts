import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { managementRequestSchema, managementDetailSchema, riderListSchema, riderOverviewSchema, pendingInvitationsSchema } from "../types/rider-management.types";
export function riderManagementSession(request: NextRequest) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const parsed = managementRequestSchema.safeParse(body);
    if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
    async function read<T extends z.ZodType>(path: string, schema: T): Promise<z.infer<T>> {
      const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(await expressAuth(path, undefined, accessToken));
      if (!envelope.success) throw new SessionError(502, "INVALID_RESPONSE");
      const response = schema.safeParse(envelope.data.data);
      if (!response.success) throw new SessionError(502, "INVALID_RESPONSE");
      return response.data;
    }
    const input = parsed.data;
    if (input.action === "detail") {
      const result = await read(`/api/operator/riders/${input.id}?page=${input.page}&pageSize=20`, managementDetailSchema);
      if (result.rider.id !== input.id) throw new SessionError(502, "INVALID_RESPONSE");
      return { success: true, data: result };
    }
    const params = new URLSearchParams(Object.entries(input.query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    const [list, overview, pending] = await Promise.all([
      read(`/api/operator/riders?${params}`, riderListSchema), read("/api/operator/riders/overview", riderOverviewSchema),
      read(`/api/operator/riders/invitations?page=${input.invitationPage}&pageSize=10`, pendingInvitationsSchema),
    ]);
    return { success: true, data: { list, overview, pending } };
  });
}
