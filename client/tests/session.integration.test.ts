// @vitest-environment node
import { createRequire } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

vi.mock("server-only", () => ({}));
import { cookieNames, loginSession, logoutSession, orderStatusSession, ordersSession, restoreSession } from "@/features/auth/server/session";

const require = createRequire(import.meta.url);
type Account = { id: string; email: string; passwordHash: string; emailVerifiedAt: Date | null; profile: { id: string; fullName: null; phone: null; role: string } };
type Session = { accountId: string; accessHash: string; refreshHash: string; accessExpiresAt: Date; refreshExpiresAt: Date };
const accounts = new Map<string, Account>();
const sessions = new Map<string, Session>();
const passwordResetTokens = new Map<string, { accountId: string; expiresAt: Date }>();
const resetEmails = new Map<string, string>();
let server: Server;
let backend: string;
let rotations = 0;
const capturedListFilters: { statuses: string[] }[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  const repo = require("../../server/dist/modules/auth/auth.repository.js");
  const users = require("../../server/dist/modules/users/user.repository.js");
  const { hashPassword } = require("../../server/dist/modules/auth/auth.password.js");
  const passwordHash = await hashPassword("correct-password");
  for (const [email, verified, role] of [["verified@example.com", true, "SME"], ["unverified@example.com", false, "SME"], ["operator@example.com", true, "OPERATOR"]] as const) {
    const id = randomUUID();
    accounts.set(email, { id, email, passwordHash, emailVerifiedAt: verified ? new Date() : null, profile: { id, fullName: null, phone: null, role } });
  }
  repo.findAccount = async (email: string) => accounts.get(email) ?? null;
  repo.createSession = async (data: Session) => { sessions.set(randomUUID(), data); return data; };
  repo.findSession = async (accessHash: string) => {
    const session = [...sessions.values()].find((s) => s.accessHash === accessHash);
    return session ? { ...session, account: [...accounts.values()].find((a) => a.id === session.accountId) } : null;
  };
  repo.rotateSession = async (refreshHash: string, data: Partial<Session>) => {
    const session = [...sessions.values()].find((s) => s.refreshHash === refreshHash && s.refreshExpiresAt > new Date());
    if (!session) return null;
    rotations++;
    Object.assign(session, data);
    return [...accounts.values()].find((a) => a.id === session.accountId);
  };
  repo.revokeSession = async (accessHash: string) => { for (const [id, session] of sessions) if (session.accessHash === accessHash) sessions.delete(id); };
  require("../../server/dist/lib/email/email.service.js").sendAccountEmail = async (email: string, purpose: string, token: string) => {
    if (purpose === "password-reset") resetEmails.set(email, token);
  };
  repo.reserveEmailToken = async (accountId: string, purpose: string, tokenHash: string) => {
    if (purpose === "password-reset") passwordResetTokens.set(tokenHash, { accountId, expiresAt: new Date(Date.now() + 900000) });
    return true;
  };
  repo.resetAccountPassword = async (tokenHash: string, nextPasswordHash: string) => {
    const reset = passwordResetTokens.get(tokenHash);
    if (!reset || reset.expiresAt <= new Date()) return false;
    passwordResetTokens.delete(tokenHash);
    const account = [...accounts.values()].find((a) => a.id === reset.accountId)!;
    account.passwordHash = nextPasswordHash;
    for (const [id, session] of sessions) if (session.accountId === account.id) sessions.delete(id);
    return true;
  };
  users.findProfile = async (id: string) => [...accounts.values()].find((a) => a.id === id)?.profile ?? null;
  const orders = require("../../server/dist/modules/orders/order.repository.js");
  orders.listOrdersWithCount = async (filters: { statuses: string[] }) => {
    capturedListFilters.push(filters);
    return [
      [],
      0,
      [
        { status: "CREATED", _count: { _all: 5 } },
        { status: "DELIVERED", _count: { _all: 10 } },
        { status: "FAILED", _count: { _all: 2 } },
      ],
    ];
  };
  orders.findStatusByIdentifier = async (_ownerId: string, identifier: { kind: string; value: string }) => {
    const code = identifier.kind === "orderCode" ? identifier.value : identifier.value.toUpperCase();
    return code === "POAABBCCDDEEFF0011" ? {
      id: "3d0f2b7c-8a51-4c62-9f10-5b6c7d8e9f00",
      orderCode: code,
      status: "IN_TRANSIT",
      createdAt: new Date("2026-10-20T00:00:00.000Z"),
      statusEvents: [
        { status: "PICKED_UP", previousStatus: "CREATED", note: null, createdAt: new Date("2026-10-20T02:15:00.000Z") },
      ],
    } : null;
  };
  const { app } = require("../../server/dist/app.js");
  const express = require("../../server/node_modules/express");
  const wrapper = express();
  // Test-only resource exercises the real role middleware; no production route is added.
  wrapper.get("/operator-only", require("../../server/dist/middleware/require-auth.js").requireAuth, require("../../server/dist/middleware/require-role.js").requireRole("OPERATOR"), (_request: unknown, response: { json: (value: unknown) => void }) => response.json({ success: true }));
  wrapper.use(app);
  server = wrapper.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address");
  backend = `http://127.0.0.1:${address.port}`;
  vi.stubEnv("EXPRESS_API_URL", backend);
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await require("../../server/dist/config/prisma.js").prisma.$disconnect();
  vi.unstubAllEnvs();
});

function request(path: string, cookies = "", body: unknown = {}, origin = "http://localhost:3000") {
  return new NextRequest(`http://localhost:3000/api/session/${path}`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookies }, body: JSON.stringify(body),
  });
}
function jar(response: NextResponse) { return response.cookies.getAll().map((c) => `${c.name}=${c.value}`).join("; "); }
function getRequest(search: string, cookies = "", origin?: string) {
  const headers: Record<string, string> = { "Sec-Fetch-Site": "same-origin", Cookie: cookies };
  if (origin) headers.Origin = origin;
  return new NextRequest(`http://localhost:3000/api/session/orders${search}`, { method: "GET", headers });
}
function statusRequest(id: string, cookies = "", origin?: string) {
  const headers: Record<string, string> = { "Sec-Fetch-Site": "same-origin", Cookie: cookies };
  if (origin) headers.Origin = origin;
  return new NextRequest(`http://localhost:3000/api/session/orders/${id}/status`, { method: "GET", headers });
}
async function login(email = "verified@example.com", password = "correct-password") {
  return loginSession(request("login", "", { email, password }));
}

describe("BFF against the real Express controllers and auth services (in-memory repositories)", () => {
  it("sets HttpOnly scoped cookies while returning only current profile data", async () => {
    const response = await login();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.user.role).toBe("SME");
    expect(payload.data.user.id).toBe(accounts.get("verified@example.com")!.id);
    expect(JSON.stringify(payload)).not.toMatch(/accessToken|refreshToken|password/);
    for (const cookie of response.cookies.getAll()) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("strict");
      expect(cookie.path).toBe("/api/session");
    }
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const restored = await restoreSession(request("me", jar(response)));
    expect((await restored.json()).data.user).toEqual(payload.data.user);
  });

  it("returns actual incorrect-password and unverified-email error codes", async () => {
    const invalid = await login("verified@example.com", "wrong");
    expect(invalid.status).toBe(401);
    expect((await invalid.json()).error.code).toBe("LOGIN_FAILED");
    const unverified = await login("unverified@example.com");
    expect(unverified.status).toBe(403);
    expect((await unverified.json()).error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("rejects cross-origin, missing-origin and non-JSON requests before forwarding", async () => {
    const count = sessions.size;
    expect((await loginSession(request("login", "", { email: "verified@example.com", password: "correct-password" }, "https://evil.example"))).status).toBe(403);
    const missing = new NextRequest("http://localhost:3000/api/session/logout", { method: "POST" });
    expect((await logoutSession(missing)).status).toBe(403);
    const plain = new NextRequest("http://localhost:3000/api/session/login", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "text/plain" }, body: "{}" });
    expect((await loginSession(plain)).status).toBe(415);
    expect(sessions.size).toBe(count);
  });

  it("validates credentials and clears invalid sessions", async () => {
    expect((await loginSession(request("login", "", { email: "bad", password: "" }))).status).toBe(400);
    const response = await restoreSession(request("me", `${cookieNames.refresh}=${"x".repeat(43)}`));
    expect(response.status).toBe(401);
    expect(response.cookies.get(cookieNames.refresh)?.maxAge).toBe(0);
  });

  it("rotates expired access once for simultaneous requests and rejects old tokens", async () => {
    const initial = await login();
    const access = initial.cookies.get(cookieNames.access)!.value;
    const refresh = initial.cookies.get(cookieNames.refresh)!.value;
    const session = [...sessions.values()].find((s) => s.accessHash === hash(access))!;
    session.accessExpiresAt = new Date(0);
    const before = rotations;
    const responses = await Promise.all([restoreSession(request("me", jar(initial))), restoreSession(request("me", jar(initial)))]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(rotations - before).toBe(1);
    const next = responses[0].cookies.get(cookieNames.refresh)!.value;
    expect(next).not.toBe(refresh);
    expect(responses[1].cookies.get(cookieNames.refresh)!.value).toBe(next);
    const replay = await fetch(`${backend}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: refresh }) });
    expect(replay.status).toBe(401);
    expect((await fetch(`${backend}/api/users/me`, { headers: { Authorization: `Bearer ${access}` } })).status).toBe(401);
    expect((await restoreSession(request("me", jar(responses[0])))).status).toBe(200);
  });

  it("refreshes when the access cookie has expired and revokes on logout", async () => {
    const initial = await login();
    const refresh = initial.cookies.get(cookieNames.refresh)!.value;
    const restored = await restoreSession(request("me", `${cookieNames.refresh}=${refresh}`));
    expect(restored.status).toBe(200);
    const tokens = jar(restored);
    const revokedRefresh = restored.cookies.get(cookieNames.refresh)!.value;
    const loggedOut = await logoutSession(request("logout", tokens));
    expect(loggedOut.status).toBe(200);
    expect(loggedOut.cookies.get(cookieNames.access)?.maxAge).toBe(0);
    expect((await restoreSession(request("me", tokens))).status).toBe(401);
    expect((await restoreSession(request("me", `${cookieNames.refresh}=${revokedRefresh}`))).status).toBe(401);
  });

  it("enforces backend role access independently of UI state", async () => {
    const sme = await login();
    const operator = await login("operator@example.com");
    expect((await fetch(`${backend}/operator-only`, { headers: { Authorization: `Bearer ${sme.cookies.get(cookieNames.access)!.value}` } })).status).toBe(403);
    expect((await fetch(`${backend}/operator-only`, { headers: { Authorization: `Bearer ${operator.cookies.get(cookieNames.access)!.value}` } })).status).toBe(200);
  });

  it("proxies the parcel list for an SME with tab counts and rejects other origins and roles", async () => {
    const sme = await login();
    const list = await ordersSession(getRequest("?tab=needs_pickup", jar(sme)));
    expect(list.status).toBe(200);
    const payload = await list.json();
    expect(payload.data.tabCounts).toEqual({ all: 17, needsPickup: 5, exceptions: 2 });
    expect(Array.isArray(payload.data.orders)).toBe(true);
    expect(capturedListFilters.at(-1)?.statuses).toEqual(["CREATED"]);
    const filtered = await ordersSession(getRequest("?status=DELIVERED", jar(sme)));
    expect(filtered.status).toBe(200);
    expect(capturedListFilters.at(-1)?.statuses).toEqual(["DELIVERED"]);
    expect((await ordersSession(getRequest("?status=PENDING", jar(sme)))).status).toBe(400);
    expect((await ordersSession(getRequest("?tab=all", jar(sme), "https://evil.example"))).status).toBe(403);
    expect((await ordersSession(getRequest("?tab=trash", jar(sme)))).status).toBe(400);
    const operator = await login("operator@example.com");
    expect((await ordersSession(getRequest("?tab=all", jar(operator)))).status).toBe(403);
  });

  it("proxies the parcel status view for an SME and rejects invalid identifiers, other origins and roles", async () => {
    const sme = await login();
    const found = await orderStatusSession(statusRequest("poaabbccddeeff0011", jar(sme)), "poaabbccddeeff0011");
    expect(found.status).toBe(200);
    const payload = await found.json();
    expect(payload.data.orderCode).toBe("POAABBCCDDEEFF0011");
    expect(payload.data.status).toBe("IN_TRANSIT");
    expect(payload.data.timeline.length).toBeGreaterThan(0);
    expect(JSON.stringify(payload)).not.toMatch(/recipientName|phoneNumber|deliveryAddress|codAmount|township/);
    expect((await orderStatusSession(statusRequest("not-a-code", jar(sme)), "not-a-code")).status).toBe(400);
    expect((await orderStatusSession(statusRequest("POFFFFFFFFFFFFFFFF", jar(sme)), "POFFFFFFFFFFFFFFFF")).status).toBe(404);
    expect((await orderStatusSession(statusRequest("POAABBCCDDEEFF0011", jar(sme), "https://evil.example"), "POAABBCCDDEEFF0011")).status).toBe(403);
    const operator = await login("operator@example.com");
    expect((await orderStatusSession(statusRequest("POAABBCCDDEEFF0011", jar(operator)), "POAABBCCDDEEFF0011")).status).toBe(403);
  });

  it("uses Secure cookies in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const response = await login();
      expect(response.status).toBe(200);
      expect(response.cookies.get(cookieNames.refresh)?.secure).toBe(true);
    } finally { vi.stubEnv("NODE_ENV", "test"); }
  });

  it("recovers a password through Express, revokes sessions and accepts only the new password", async () => {
    const initial = await login();
    const access = initial.cookies.get(cookieNames.access)!.value;
    const refresh = initial.cookies.get(cookieNames.refresh)!.value;
    async function post(path: string, data: unknown) {
      return fetch(`${backend}/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    }
    const known = await post("forgot-password", { email: "verified@example.com" });
    const unknown = await post("forgot-password", { email: "unknown@example.com" });
    expect(known.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    const token = resetEmails.get("verified@example.com")!;
    expect(token).toHaveLength(43);
    expect(resetEmails.has("unknown@example.com")).toBe(false);
    expect((await post("reset-password", { token: "z".repeat(43), newPassword: "updated-password" })).status).toBe(400);
    const tokenRecord = passwordResetTokens.get(hash(token))!;
    tokenRecord.expiresAt = new Date(0);
    const expired = await post("reset-password", { token, newPassword: "updated-password" });
    expect(expired.status).toBe(400);
    expect((await expired.json()).error.code).toBe("INVALID_RESET_TOKEN");
    tokenRecord.expiresAt = new Date(Date.now() + 900000);
    expect((await post("reset-password", { token, newPassword: "updated-password" })).status).toBe(200);
    expect((await fetch(`${backend}/api/users/me`, { headers: { Authorization: `Bearer ${access}` } })).status).toBe(401);
    expect((await post("refresh", { refreshToken: refresh })).status).toBe(401);
    expect((await login("verified@example.com", "correct-password")).status).toBe(401);
    expect((await login("verified@example.com", "updated-password")).status).toBe(200);
    expect((await post("reset-password", { token, newPassword: "another-password" })).status).toBe(400);
    const signedOut = await logoutSession(request("logout", jar(initial)));
    expect(signedOut.status).toBe(200);
    expect(signedOut.cookies.get(cookieNames.refresh)?.maxAge).toBe(0);
  }, 15000);
});
