// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth, exchangeTokens } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn(), exchangeTokens: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async importOriginal => ({ ...await importOriginal<object>(), currentProfile, expressAuth, exchangeTokens }));
import { providersSession } from "@/features/operator/server/providers.session";
import { SessionError } from "@/features/auth/server/express-auth";
import { operatorUser } from "./fixtures/operator-orders";
const id = "550e8400-e29b-41d4-a716-446655440000", other = "660e8400-e29b-41d4-a716-446655440000", token = "a".repeat(43);
const price = { id, providerId: other, city: "yangon", fee: "3500.00", currency: "MMK", isActive: true, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z" };
function request(body: unknown, cookies = `parcelops_access=${token}`, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/session/operator/delivery-providers", { method: "POST", headers: { Cookie: cookies, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue(operatorUser); });
it("denies missing sessions, wrong roles and cross-site requests", async () => {
  expect((await providersSession(request({ action: "list" }, ""))).status).toBe(401);
  expect((await providersSession(request({ action: "list" }, undefined, "https://evil.example"))).status).toBe(403);
  for (const role of ["SME", "RIDER"]) { currentProfile.mockResolvedValue({ ...operatorUser, role }); expect((await providersSession(request({ action: "list" }))).status).toBe(403); }
  expect(expressAuth).not.toHaveBeenCalled();
});
it("forwards only fixed membership-based paths and normalized price inputs", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { provider: null } });
  expect((await providersSession(request({ action: "list" }))).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith("/api/operator/my-provider", undefined, token);
  expressAuth.mockResolvedValue({ success: true, data: price });
  expect((await providersSession(request({ action: "create", city: " YANGON ", fee: "3500.00", isActive: true }))).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith("/api/operator/my-provider/city-prices", { city: "yangon", fee: "3500.00", isActive: true }, token);
  expect((await providersSession(request({ action: "update", priceId: id, isActive: false }))).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith(`/api/operator/my-provider/city-prices/${id}`, { city: undefined, fee: undefined, isActive: false }, token, "PATCH");
});
it("rejects provider creation, provider IDs, role injection and invalid fees", async () => {
  for (const body of [{ action: "create", name: "Bad" }, { action: "create", city: "Yangon", fee: "1", isActive: true, providerId: other }, { action: "update", priceId: id, fee: "-1" }, { action: "list", role: "OPERATOR" }, { action: "update", priceId: "../auth", isActive: true }]) expect((await providersSession(request(body))).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("rejects mismatched price IDs and cities, and strips secrets", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { ...price, secret: "private" } });
  const good = await providersSession(request({ action: "update", priceId: id, fee: "4000" }));
  expect(JSON.stringify(await good.json())).not.toContain("private");
  expressAuth.mockResolvedValue({ success: true, data: { ...price, id: other } });
  expect((await providersSession(request({ action: "update", priceId: id, isActive: false }))).status).toBe(502);
  expressAuth.mockResolvedValue({ success: true, data: { ...price, city: "mandalay" } });
  expect((await providersSession(request({ action: "create", city: "yangon", fee: "1", isActive: true }))).status).toBe(502);
});
it.each([404, 409, 429, 503])("preserves pricing HTTP %s failures", async status => {
  expressAuth.mockRejectedValue(new SessionError(status, "PROVIDER_MEMBERSHIP_REQUIRED"));
  expect((await providersSession(request({ action: "update", priceId: id, isActive: false }))).status).toBe(status);
});
