import "server-only";

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { invitationResponseSchema } from "@/features/riders/api/rider.api";
import { z } from "zod";
import { profileUpdateSchema } from "@/features/profile/schemas/profile.schema";
import { authUserSchema } from "../schemas/auth.schema";
import { loginSchema } from "../schemas/auth.schema";
import { currentProfile, exchangeTokens, expressAuth, SessionError, type Tokens } from "./express-auth";

export const cookieNames = { access: "parcelops_access", refresh: "parcelops_refresh" };
const cookiePath = "/api/session";
const refreshTTL = 30 * 86400;
type Rotation = { expires: number; promise: Promise<Tokens> };
// Shared by route handlers in one Node process, including development reloads.
const processState = globalThis as typeof globalThis & { parcelopsRotations?: Map<string, Rotation> };
const rotations = processState.parcelopsRotations ??= new Map<string, Rotation>();

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: cookiePath };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" } });
}

function clearCookies(response: NextResponse) {
  for (const name of Object.values(cookieNames)) response.cookies.set(name, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}

function writeCookies(response: NextResponse, tokens: Tokens) {
  response.cookies.set(cookieNames.access, tokens.accessToken, { ...cookieOptions(), maxAge: tokens.expiresIn });
  response.cookies.set(cookieNames.refresh, tokens.refreshToken, { ...cookieOptions(), maxAge: refreshTTL });
  return response;
}

function guard(request: NextRequest) {
  const expected = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin;
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new SessionError(403, "INVALID_ORIGIN");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new SessionError(415, "INVALID_CONTENT_TYPE");
  }
}

function errorResponse(cause: unknown) {
  const error = cause instanceof SessionError ? cause : new SessionError(503, "SERVICE_UNAVAILABLE");
  const response = json({ success: false, error: { code: error.code, message: "The authentication request could not be completed." } }, error.status);
  return error.status === 401 || error.code === "EMAIL_NOT_VERIFIED" ? clearCookies(response) : response;
}

async function rotate(refreshToken: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw new SessionError(401, "UNAUTHORIZED");
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const now = Date.now();
  for (const [id, value] of rotations) if (value.expires <= now) rotations.delete(id);
  const previous = rotations.get(key);
  if (previous) return previous.promise;
  if (rotations.size >= 1000) throw new SessionError(503, "SERVICE_UNAVAILABLE");
  const promise = exchangeTokens("/api/auth/refresh", { refreshToken });
  const rotation = { expires: now + 30000, promise };
  rotations.set(key, rotation);
  try {
    const tokens = await promise;
    // Briefly reuse results for requests carrying cookies from before rotation.
    rotation.expires = Date.now() + 10000;
    const timer = setTimeout(() => { if (rotations.get(key) === rotation) rotations.delete(key); }, 10000);
    timer.unref?.();
    return tokens;
  } catch (error) { rotations.delete(key); throw error; }
}

async function authenticated(request: NextRequest) {
  const accessToken = request.cookies.get(cookieNames.access)?.value;
  if (accessToken && /^[A-Za-z0-9_-]{43}$/.test(accessToken)) {
    try { return { user: await currentProfile(accessToken), accessToken, tokens: undefined }; }
    catch (error) { if (!(error instanceof SessionError && error.status === 401)) throw error; }
  }
  const refreshToken = request.cookies.get(cookieNames.refresh)?.value;
  if (!refreshToken) throw new SessionError(401, "UNAUTHORIZED");
  const tokens = await rotate(refreshToken);
  const user = await currentProfile(tokens.accessToken);
  if (user.id !== tokens.user.id) throw new SessionError(502, "INVALID_RESPONSE");
  return { user, accessToken: tokens.accessToken, tokens };
}

// Reuse the existing cookie/rotation boundary for feature-specific read requests.
export async function withAuthenticatedSession(request: NextRequest,
  read: (session: { user: z.infer<typeof authUserSchema>; accessToken: string }) => Promise<unknown>) {
  let rotated: Tokens | undefined;
  try {
    guard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    const response = json(await read(session));
    return rotated ? writeCookies(response, rotated) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 && !(error instanceof SessionError && error.code === "EMAIL_NOT_VERIFIED")
      ? writeCookies(response, rotated) : response;
  }
}

export async function loginSession(request: NextRequest) {
  try {
    guard(request);
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const credentials = loginSchema.safeParse(body);
    if (!credentials.success) throw new SessionError(400, "VALIDATION_ERROR");
    const tokens = await exchangeTokens("/api/auth/login", credentials.data);
    const user = await currentProfile(tokens.accessToken);
    if (user.id !== tokens.user.id) throw new SessionError(502, "INVALID_RESPONSE");
    return writeCookies(json({ success: true, data: { user } }), tokens);
  } catch (error) { return errorResponse(error); }
}

export async function restoreSession(request: NextRequest) {
  try {
    guard(request);
    const session = await authenticated(request);
    const response = json({ success: true, data: { user: session.user } });
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) { return errorResponse(error); }
}

export async function logoutSession(request: NextRequest) {
  try {
    guard(request);
    try {
      const session = await authenticated(request);
      await expressAuth("/api/auth/logout", {}, session.accessToken);
    } catch (error) {
      // Invalid sessions are already logged out. An outage must allow retrying revocation.
      if (!(error instanceof SessionError && error.status === 401)) throw error;
    }
    return clearCookies(json({ success: true, data: { message: "Signed out." } }));
  } catch (error) { return errorResponse(error); }
}

export async function inviteRiderSession(request: NextRequest) {
  let rotated: Tokens | undefined;
  try {
    guard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "OPERATOR") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const input = z.object({ email: z.string().trim().email().max(254), fullName: z.string().trim().min(1).max(120).optional() }).strict().safeParse(body);
    if (!input.success) throw new SessionError(400, "VALIDATION_ERROR");
    const result = invitationResponseSchema.safeParse(await expressAuth("/api/riders/invitations", input.data, session.accessToken));
    if (!result.success) throw new SessionError(502, "INVALID_RESPONSE");
    const response = json(result.data, 201);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}

export async function updateProfileSession(request: NextRequest) {
  let rotated: Tokens | undefined;
  try {
    guard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    const text = await request.text();
    if (text.length > 16384) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const input = profileUpdateSchema.safeParse(body);
    if (!input.success) throw new SessionError(400, "VALIDATION_ERROR");
    const result = z.object({ success: z.literal(true), data: authUserSchema }).safeParse(await expressAuth("/api/users/me", input.data, session.accessToken, "PATCH"));
    if (!result.success || result.data.data.id !== session.user.id || result.data.data.role !== session.user.role) throw new SessionError(502, "INVALID_RESPONSE");
    const response = json({ success: true, data: { user: result.data.data } });
    return rotated ? writeCookies(response, rotated) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 && !(error instanceof SessionError && error.code === "EMAIL_NOT_VERIFIED") ? writeCookies(response, rotated) : response;
  }
}

export async function smeDashboardSession(request: NextRequest) {
  let rotated: Tokens | undefined;
  try {
    guard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 1024) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    if (!z.object({}).strict().safeParse(body).success) throw new SessionError(400, "VALIDATION_ERROR");
    const result = await expressAuth("/api/sme/dashboard", undefined, session.accessToken);
    const response = json(result);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}

// Same-origin only, for read requests that carry no body. Browsers commonly omit Origin on
// same-origin GETs, so a matching sec-fetch-site is accepted; cross-site and unknown are not.
function readGuard(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (site === "cross-site") throw new SessionError(403, "INVALID_ORIGIN");
  if (origin) {
    const expected = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin;
    if (origin !== expected) throw new SessionError(403, "INVALID_ORIGIN");
    return;
  }
  if (site !== "same-origin") throw new SessionError(403, "INVALID_ORIGIN");
}

const orderListParams = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"]).optional(),
  tab: z.enum(["all", "needs_pickup", "exceptions"]).optional(),
}).strict();

// Forward allowlisted parcel-list query params to Express with the caller's access token.
export async function ordersSession(request: NextRequest) {
  let rotated: Tokens | undefined;
  try {
    readGuard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const params = orderListParams.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!params.success) throw new SessionError(400, "VALIDATION_ERROR");
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params.data)) if (value !== undefined) query.set(key, String(value));
    const suffix = query.toString();
    const result = await expressAuth(`/api/orders${suffix ? `?${suffix}` : ""}`, undefined, session.accessToken);
    const response = json(result);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}

export async function deliveryServicesSession(request: NextRequest) {
  let rotated: Tokens | undefined;
  try {
    readGuard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const params = z.object({ city: z.string().trim().min(1).max(120) }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!params.success) throw new SessionError(400, "VALIDATION_ERROR");
    const query = new URLSearchParams({ city: params.data.city });
    const result = await expressAuth(`/api/delivery/services?${query.toString()}`, undefined, session.accessToken);
    const response = json(result);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}

export async function deliveryCitiesSession(request: NextRequest) {
  let rotated: Tokens | undefined;
  try {
    readGuard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const result = await expressAuth("/api/delivery/cities", undefined, session.accessToken);
    const response = json(result);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}
export async function createOrderSession(request: NextRequest) {
  let rotated: Tokens | undefined;
  try {
    guard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const text = await request.text();
    if (text.length > 32768) throw new SessionError(413, "INVALID_REQUEST");
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new SessionError(400, "VALIDATION_ERROR"); }
    const result = await expressAuth("/api/orders", body, session.accessToken);
    const response = json(result, 201);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}

const orderIdentifierSchema = z
  .string()
  .trim()
  .max(64)
  .refine(
    (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^PO[0-9a-f]{16}$/i.test(value),
    { message: "Parcel identifier must be a valid order id or order code." },
  );

// Forward a parcel detail lookup to Express with the caller's access token.
export async function orderDetailSession(request: NextRequest, id: string) {
  let rotated: Tokens | undefined;
  try {
    readGuard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const identifier = orderIdentifierSchema.safeParse(id);
    if (!identifier.success) throw new SessionError(400, "VALIDATION_ERROR");
    const result = await expressAuth(`/api/orders/${encodeURIComponent(identifier.data)}`, undefined, session.accessToken);
    const response = json(result);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}

// Forward a parcel QR lookup to Express with the caller's access token.
export async function orderQrSession(request: NextRequest, id: string) {
  let rotated: Tokens | undefined;
  try {
    readGuard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const identifier = orderIdentifierSchema.safeParse(id);
    if (!identifier.success) throw new SessionError(400, "VALIDATION_ERROR");
    const result = await expressAuth(`/api/orders/${encodeURIComponent(identifier.data)}/qr`, undefined, session.accessToken);
    const response = json(result);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}

// Forward a parcel status lookup to Express with the caller's access token.
export async function orderStatusSession(request: NextRequest, id: string) {
  let rotated: Tokens | undefined;
  try {
    readGuard(request);
    const session = await authenticated(request);
    rotated = session.tokens;
    if (session.user.role !== "SME") throw new SessionError(403, "FORBIDDEN");
    const identifier = orderIdentifierSchema.safeParse(id);
    if (!identifier.success) throw new SessionError(400, "VALIDATION_ERROR");
    const result = await expressAuth(`/api/orders/${encodeURIComponent(identifier.data)}/status`, undefined, session.accessToken);
    const response = json(result);
    return session.tokens ? writeCookies(response, session.tokens) : response;
  } catch (error) {
    const response = errorResponse(error);
    return rotated && response.status !== 401 ? writeCookies(response, rotated) : response;
  }
}
