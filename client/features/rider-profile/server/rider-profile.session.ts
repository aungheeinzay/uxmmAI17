import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { riderProfileSchema, riderProfileUpdateRequestSchema } from "../types/rider-profile.types";

export function riderProfileSession(request: NextRequest, operation: "get" | "update") {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "RIDER") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }

    let input: unknown;
    if (operation === "update") {
      const parsed = riderProfileUpdateRequestSchema.safeParse(body);
      if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
      input = parsed.data;
    } else if (!z.object({}).strict().safeParse(body).success) {
      throw new SessionError(400, "VALIDATION_ERROR");
    }

    const result = z.object({ success: z.literal(true), data: riderProfileSchema }).safeParse(
      await expressAuth("/api/rider/profile", input, accessToken, operation === "update" ? "PATCH" : undefined),
    );
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    if (user.email && result.data.data.email && result.data.data.email !== user.email) throw new SessionError(502, "INVALID_RESPONSE");
    return result.data;
  });
}
