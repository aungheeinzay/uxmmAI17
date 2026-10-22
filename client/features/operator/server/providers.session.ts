import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withAuthenticatedSession } from "@/features/auth/server/session";
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { providerActionSchema, providerSchema, cityPriceSchema } from "../types/provider.types";
export function providersSession(request: NextRequest) {
  return withAuthenticatedSession(request, async ({ user, accessToken }) => {
    if (user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const parsed = providerActionSchema.safeParse(body);
    if (!parsed.success) throw new SessionError(400, "VALIDATION_ERROR");
    const input = parsed.data, base = "/api/operator/delivery-providers";
    let payload: unknown;
    if (input.action === "list") payload = await expressAuth(base, undefined, accessToken);
    else if (input.action === "create") payload = await expressAuth(base, { name: input.name }, accessToken);
    else if (input.action === "update") payload = await expressAuth(`${base}/${input.id}`, { name: input.name, isActive: input.isActive }, accessToken, "PATCH");
    else payload = await expressAuth(`${base}/${input.id}/city-prices/${encodeURIComponent(input.city)}`, { fee: input.fee, isActive: input.isActive }, accessToken, "PUT");
    const schema = input.action === "list" ? z.object({ providers: z.array(providerSchema) }) : input.action === "price" ? cityPriceSchema : providerSchema;
    const result = z.object({ success: z.literal(true), data: schema }).safeParse(payload);
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    if (input.action === "update") {
      const provider = providerSchema.safeParse(result.data.data);
      if (!provider.success || provider.data.id !== input.id) throw new SessionError(502, "INVALID_RESPONSE");
    }
    if (input.action === "price") {
      const price = cityPriceSchema.safeParse(result.data.data);
      if (!price.success || price.data.providerId !== input.id || price.data.city !== input.city) {
        throw new SessionError(502, "INVALID_RESPONSE");
      }
    }
    return result.data;
  });
}
