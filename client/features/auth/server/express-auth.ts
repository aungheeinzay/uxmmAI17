import "server-only";

import { z } from "zod";
import { authUserSchema } from "../schemas/auth.schema";

export class SessionError extends Error {
  constructor(public status: number, public code: string) { super("Session request failed"); }
}

export const tokenSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    expiresIn: z.number().int().positive().max(900),
    user: z.object({ id: z.string().uuid(), email: z.string().email() }),
  }),
});
export type Tokens = z.infer<typeof tokenSchema>["data"];

export async function expressAuth(path: string, body?: unknown, accessToken?: string, method?: "PATCH" | "PUT"): Promise<unknown> {
  const base = new URL(process.env.EXPRESS_API_URL ?? "http://localhost:4000");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new SessionError(503, "CONFIGURATION_ERROR");
  }
  let response: Response;
  try {
    response = await fetch(new URL(path, base), {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch { throw new SessionError(503, "SERVICE_UNAVAILABLE"); }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const result = z.object({ error: z.object({ code: z.string() }) }).safeParse(payload);
    const allowed = ["LOGIN_FAILED", "EMAIL_NOT_VERIFIED", "ACCOUNT_DEACTIVATED", "INVALID_REFRESH_TOKEN", "UNAUTHORIZED", "RATE_LIMITED", "VALIDATION_ERROR", "FORBIDDEN", "RIDER_INVITATION_CONFLICT", "EMAIL_DELIVERY_FAILED", "ORDER_NOT_FOUND", "OPERATOR_NOT_AVAILABLE", "RIDER_NOT_ELIGIBLE", "RIDER_NOT_FOUND", "PROVIDER_MEMBERSHIP_REQUIRED", "RIDER_PROVIDER_MEMBERSHIP_REQUIRED", "RIDER_PROFILE_INCOMPLETE", "RIDER_DEACTIVATED", "RIDER_HAS_ACTIVE_ASSIGNMENTS", "RIDER_DEACTIVATION_CONFLICT", "RIDER_REACTIVATION_CONFLICT", "PROFILE_NOT_FOUND", "CITY_PRICE_CONFLICT", "CITY_PRICE_NOT_FOUND", "PRICING_CONFLICT", "ASSIGNMENT_NOT_FOUND", "STATUS_TRANSITION_NOT_ALLOWED", "INCIDENT_NOT_FOUND", "INCIDENT_ALREADY_REPORTED", "INCIDENT_CONFLICT"];
    const code = result.success && allowed.includes(result.data.error.code) ? result.data.error.code : "SERVICE_UNAVAILABLE";
    throw new SessionError(response.status, code);
  }
  return payload;
}

export async function currentProfile(accessToken: string) {
  const result = z.object({ success: z.literal(true), data: authUserSchema }).safeParse(await expressAuth("/api/users/me", undefined, accessToken));
  if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
  return result.data.data;
}

export async function exchangeTokens(path: "/api/auth/login" | "/api/auth/refresh", body: unknown): Promise<Tokens> {
  const result = tokenSchema.safeParse(await expressAuth(path, body));
  if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
  return result.data.data;
}
