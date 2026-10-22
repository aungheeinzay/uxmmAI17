// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async (importOriginal) => ({ ...await importOriginal<object>(), currentProfile, expressAuth }));
import { riderProfileSession } from "@/features/rider-profile/server/rider-profile.session";

const token = "a".repeat(43);
const rider = { id: "550e8400-e29b-41d4-a716-446655440000", role: "RIDER", fullName: "Test Rider", phone: null, email: "rider@example.com" };
const profile = {
  fullName: "Test Rider", phone: "09 123 456 789", email: "rider@example.com",
  provider: { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", name: "Example Provider" },
  vehicle: { type: "MOTORCYCLE", plateNumber: "ABC-123", model: null, color: null },
  profileComplete: true, missingFields: [], completedAt: "2026-10-22T03:00:00.000Z",
};
const update = { fullName: "Test Rider", phone: "09 123 456 789", vehicleType: "MOTORCYCLE", vehiclePlateNumber: "ABC-123" };

function request(body: unknown = {}, path = "/api/session/rider/profile") {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { Origin: "http://localhost:3000", "Content-Type": "application/json", Cookie: `parcelops_access=${token}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentProfile.mockResolvedValue(rider);
  expressAuth.mockResolvedValue({ success: true, data: profile });
});

it("rejects non-Rider sessions before forwarding profile requests", async () => {
  currentProfile.mockResolvedValue({ ...rider, role: "OPERATOR" });
  const response = await riderProfileSession(request(), "get");
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  expect(expressAuth).not.toHaveBeenCalled();
});

it("forwards profile reads without a request body", async () => {
  const response = await riderProfileSession(request({}), "get");
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/rider/profile", undefined, token, undefined);
  expect(await response.json()).toEqual({ success: true, data: profile });
});

it("forwards validated profile updates with PATCH and trims values", async () => {
  const response = await riderProfileSession(request({ ...update, fullName: "  Test Rider  ", vehiclePlateNumber: " abc-123 " }), "update");
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/rider/profile", {
    fullName: "Test Rider", phone: "09 123 456 789", vehicleType: "MOTORCYCLE", vehiclePlateNumber: "abc-123",
  }, token, "PATCH");
});

it("rejects injected role, provider, completion or identity fields", async () => {
  for (const extra of [{ role: "OPERATOR" }, { providerId: "7c9e6679-7425-40de-944b-e07fc1f90ae7" }, { profileComplete: true }, { completedAt: new Date().toISOString() }, { profileId: "550e8400-e29b-41d4-a716-446655440000" }]) {
    const response = await riderProfileSession(request({ ...update, ...extra }), "update");
    expect(response.status).toBe(400);
  }
  expect(expressAuth).not.toHaveBeenCalled();
});

it("rejects extra read fields and missing required update fields", async () => {
  expect((await riderProfileSession(request({ providerId: "x" }), "get")).status).toBe(400);
  expect((await riderProfileSession(request({ fullName: "Test Rider", vehicleType: "MOTORCYCLE" }), "update")).status).toBe(400);
  expect((await riderProfileSession(request({ ...update, vehicleType: "CAR", vehiclePlateNumber: "" }), "update")).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});

it("preserves actionable backend error codes and never redirects on outages", async () => {
  const { SessionError } = await import("@/features/auth/server/express-auth");
  expressAuth.mockRejectedValueOnce(new SessionError(403, "RIDER_PROVIDER_MEMBERSHIP_REQUIRED"));
  const provider = await riderProfileSession(request({}), "get");
  expect(provider.status).toBe(403);
  expect(await provider.json()).toMatchObject({ error: { code: "RIDER_PROVIDER_MEMBERSHIP_REQUIRED" } });

  expressAuth.mockRejectedValueOnce(new SessionError(503, "SERVICE_UNAVAILABLE"));
  const outage = await riderProfileSession(request({}), "get");
  expect(outage.status).toBe(503);
  expect(await outage.json()).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
});

it("rejects mismatched identity or malformed upstream payloads", async () => {
  expressAuth.mockResolvedValueOnce({ success: true, data: { ...profile, email: "someone@example.com" } });
  expect((await riderProfileSession(request({}), "get")).status).toBe(502);
  expressAuth.mockResolvedValueOnce({ success: true, data: { ...profile, profileComplete: "yes" } });
  expect((await riderProfileSession(request({}), "get")).status).toBe(502);
});
