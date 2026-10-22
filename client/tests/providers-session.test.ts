// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth, exchangeTokens } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn(), exchangeTokens: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async importOriginal => ({ ...await importOriginal<object>(), currentProfile, expressAuth, exchangeTokens }));
import { providersSession } from "@/features/operator/server/providers.session";
import { SessionError } from "@/features/auth/server/express-auth";
import { operatorUser } from "./fixtures/operator-orders";
const id = "550e8400-e29b-41d4-a716-446655440000";
const other = "660e8400-e29b-41d4-a716-446655440000";
const token = "a".repeat(43);
const timestamp = "2026-10-22T00:00:00Z";
const price = { id: other, providerId: id, city: "yangon", fee: "3500.00", currency: "MMK", isActive: true, createdAt: timestamp, updatedAt: timestamp };
const provider = { id, name: "Express", isActive: true, cityPrices: [price], createdAt: timestamp, updatedAt: timestamp };
function request(body: unknown, cookies = `parcelops_access=${token}`, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/session/operator/delivery-providers", { method: "POST",
    headers: { Cookie: cookies, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue(operatorUser); });
it("denies missing sessions, wrong roles and cross-site mutations before forwarding", async () => {
  expect((await providersSession(request({ action: "list" }, ""))).status).toBe(401);
  expect((await providersSession(request({ action: "create", name: "Express" }, undefined, "https://evil.example"))).status).toBe(403);
  for (const role of ["SME", "RIDER"]) {
    currentProfile.mockResolvedValue({ ...operatorUser, role });
    expect((await providersSession(request({ action: "list" }))).status).toBe(403);
  }
  expect(expressAuth).not.toHaveBeenCalled();
});
it("uses fixed endpoints, server-held tokens, and normalized price keys", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { providers: [provider] } });
  const list = await providersSession(request({ action: "list" }));
  expect(list.status).toBe(200); expect(list.headers.get("Cache-Control")).toContain("no-store");
  expect(expressAuth).toHaveBeenLastCalledWith("/api/operator/delivery-providers", undefined, token);
  expressAuth.mockResolvedValue({ success: true, data: provider });
  expect((await providersSession(request({ action: "create", name: " Express " }))).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith("/api/operator/delivery-providers", { name: "Express" }, token);
  expect((await providersSession(request({ action: "update", id, name: "Express", isActive: false }))).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith(`/api/operator/delivery-providers/${id}`, { name: "Express", isActive: false }, token, "PATCH");
  expressAuth.mockResolvedValue({ success: true, data: price });
  expect((await providersSession(request({ action: "price", id, city: " YANGON ", fee: "3500.00", isActive: true }))).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith(`/api/operator/delivery-providers/${id}/city-prices/yangon`, { fee: "3500.00", isActive: true }, token, "PUT");
});
it("rejects invalid IDs, fees and injected identities", async () => {
  for (const body of [
    { action: "update", id: "../auth", name: "X", isActive: true },
    { action: "price", id, city: "Yangon", fee: "-1", isActive: true },
    { action: "create", name: "X", role: "OPERATOR" },
    { action: "list", actorId: id },
  ]) expect((await providersSession(request(body))).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("strips backend extras and rejects mismatched provider or city responses", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { ...provider, secret: "private" } });
  const valid = await providersSession(request({ action: "update", id, name: "Express", isActive: true }));
  expect(JSON.stringify(await valid.json())).not.toContain("private");
  expressAuth.mockResolvedValue({ success: true, data: { ...provider, id: other } });
  expect((await providersSession(request({ action: "update", id, name: "Express", isActive: true }))).status).toBe(502);
  for (const wrong of [{ ...price, providerId: other }, { ...price, city: "mandalay" }, {}]) {
    expressAuth.mockResolvedValue({ success: true, data: wrong });
    expect((await providersSession(request({ action: "price", id, city: "Yangon", fee: "3500", isActive: true }))).status).toBe(502);
  }
});
it.each([404, 409, 429, 503])("preserves backend HTTP %s failures", async status => {
  expressAuth.mockRejectedValue(new SessionError(status, "SERVICE_UNAVAILABLE"));
  expect((await providersSession(request({ action: "create", name: "Express" }))).status).toBe(status);
});
