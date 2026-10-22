import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { providerActionSchema, myProviderSchema, cityPriceSchema } from "../types/provider.types";
export function providersSession(request: NextRequest) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const parsed = providerActionSchema.safeParse(body);
    if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
    const input = parsed.data, base = "/api/operator/my-provider";
    let payload: unknown;
    if (input.action === "list") payload = await expressAuth(base, undefined, accessToken);
    else if (input.action === "create") payload = await expressAuth(`${base}/city-prices`, { city: input.city, fee: input.fee, isActive: input.isActive }, accessToken);
    else payload = await expressAuth(`${base}/city-prices/${input.priceId}`, { city: input.city, fee: input.fee, isActive: input.isActive }, accessToken, "PATCH");
    const schema = input.action === "list" ? myProviderSchema : cityPriceSchema;
    const result = z.object({ success: z.literal(true), data: schema }).safeParse(payload);
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    if (input.action === "update") {
      const price = cityPriceSchema.safeParse(result.data.data);
      if (!price.success || price.data.id !== input.priceId || (input.city !== undefined && price.data.city !== input.city)) throw new SessionError(502, "INVALID_RESPONSE");
    }
    if (input.action === "create") {
      const price = cityPriceSchema.safeParse(result.data.data);
      if (!price.success || price.data.city !== input.city) {
        throw new SessionError(502, "INVALID_RESPONSE");
      }
    }
    return result.data;
  });
}
