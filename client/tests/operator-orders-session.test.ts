// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth, exchangeTokens } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn(), exchangeTokens: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async importOriginal => ({ ...await importOriginal<object>(), currentProfile, expressAuth, exchangeTokens }));
import { operatorOrdersSession, receiveParcelSession } from "@/features/operator/server/operator-orders.session";
import { SessionError } from "@/features/auth/server/express-auth";
import { operatorUser, parcel, parcelList } from "./fixtures/operator-orders";
const token = "a".repeat(43);
it("receives through a fixed PATCH with server identity and sanitizes the response", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { ...parcel, status: "PICKED_UP", previousStatus: "CREATED", secret: "private" } });
  const response = await receiveParcelSession(request({ id: parcel.id }));
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith(`/api/operator/orders/${parcel.id}/receive`, {}, token, "PATCH");
  expect(JSON.stringify(await response.json())).not.toContain("private");
});
it("denies receiving without a trusted Operator session, valid origin and strict input", async () => {
  for (const role of ["SME", "RIDER"]) {
    currentProfile.mockResolvedValue({ ...operatorUser, role });
    expect((await receiveParcelSession(request({ id: parcel.id }))).status).toBe(403);
  }
  currentProfile.mockResolvedValue(operatorUser);
  expect((await receiveParcelSession(request({ id: parcel.id }, ""))).status).toBe(401);
  expect((await receiveParcelSession(request({ id: parcel.id }, undefined, "https://evil.example"))).status).toBe(403);
  for (const body of [{ id: "../auth" }, { id: parcel.id, actorId: operatorUser.id }, { id: parcel.id, role: "OPERATOR" }]) {
    expect((await receiveParcelSession(request(body))).status).toBe(400);
  }
  expect(expressAuth).not.toHaveBeenCalled();
});
it.each([409, 429, 500, 503])("preserves receiving %s and valid session cookies", async status => {
  expressAuth.mockRejectedValue(new SessionError(status, "SERVICE_UNAVAILABLE"));
  const response = await receiveParcelSession(request({ id: parcel.id }));
  expect(response.status).toBe(status); expect(response.cookies.get("parcelops_access")).toBeUndefined();
});
function request(body: unknown = {}, cookies = `parcelops_access=${token}`, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/session/operator/orders", { method: "POST",
    headers: { Cookie: cookies, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue(operatorUser); expressAuth.mockResolvedValue({ success: true, data: parcelList }); });
it("uses the fixed operator GET endpoint with server-held tokens and only supported filters", async () => {
  const response = await operatorOrdersSession(request({ page: 2, pageSize: 10, status: "CREATED", search: "Test", township: "Tamwe", createdDate: "2026-10-21" }));
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/orders?page=2&pageSize=10&search=Test&status=CREATED&township=Tamwe&createdDate=2026-10-21", undefined, token);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it.each(["SME", "RIDER"])("denies trusted %s roles before forwarding", async role => {
  currentProfile.mockResolvedValue({ ...operatorUser, role });
  expect((await operatorOrdersSession(request())).status).toBe(403);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("rejects anonymous, cross-site, invalid filters and invalid IDs", async () => {
  expect((await operatorOrdersSession(request({}, ""))).status).toBe(401);
  expect((await operatorOrdersSession(request({}, "", "https://evil.example"))).status).toBe(403);
  for (const body of [{ page: 0 }, { status: "PENDING" }, { ownerId: operatorUser.id }, { createdDate: "2026-02-30" }]) {
    expect((await operatorOrdersSession(request(body))).status).toBe(400);
  }
  expect((await operatorOrdersSession(request({ id: "../auth" }), true)).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("strips unexpected account secrets from list and detail payloads", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { ...parcelList, orders: [{ ...parcel, accessToken: "private", owner: { ...parcel.owner, account: { passwordHash: "private" } } }] } });
  const list = await operatorOrdersSession(request());
  expect(JSON.stringify(await list.json())).not.toMatch(/private|passwordHash|accessToken/);
  expressAuth.mockResolvedValue({ success: true, data: { ...parcel, account: { secret: "private" } } });
  const detail = await operatorOrdersSession(request({ id: parcel.id }), true);
  expect(detail.status).toBe(200); expect(JSON.stringify(await detail.json())).not.toContain("private");
  expect(expressAuth).toHaveBeenLastCalledWith(`/api/operator/orders/${parcel.id}`, undefined, token);
});
it("rejects invalid backend contracts and preserves missing order status", async () => {
  expressAuth.mockResolvedValue({ success: true, data: {} });
  expect((await operatorOrdersSession(request())).status).toBe(502);
  expressAuth.mockRejectedValue(new SessionError(404, "SERVICE_UNAVAILABLE"));
  const response = await operatorOrdersSession(request({ id: parcel.id }), true);
  expect(response.status).toBe(404); expect((await response.json()).error.code).toBe("ORDER_NOT_FOUND");
});
it("preserves cookie rotation on read failures and clears rejected sessions", async () => {
  exchangeTokens.mockResolvedValue({ accessToken: "b".repeat(43), refreshToken: "c".repeat(43), expiresIn: 900, user: { id: operatorUser.id, email: "test@example.invalid" } });
  expressAuth.mockRejectedValue(new SessionError(503, "SERVICE_UNAVAILABLE"));
  const response = await operatorOrdersSession(request({}, `parcelops_refresh=${"d".repeat(43)}`));
  expect(response.status).toBe(503); expect(response.cookies.get("parcelops_access")?.value).toBe("b".repeat(43));
  expressAuth.mockRejectedValue(new SessionError(401, "UNAUTHORIZED"));
  const rejected = await operatorOrdersSession(request());
  expect(rejected.status).toBe(401); expect(rejected.cookies.get("parcelops_access")?.value).toBe("");
});
