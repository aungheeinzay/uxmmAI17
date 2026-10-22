// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async original => ({ ...await original<object>(), currentProfile, expressAuth }));
import { warehouseSession } from "@/features/operator/server/warehouse.session";
import { SessionError } from "@/features/auth/server/express-auth";
import { operatorUser, parcel } from "./fixtures/operator-orders";
const token = "a".repeat(43);
const overview = { scope: "ALL_TIME", unassigned: 1, assignedAwaitingDispatch: 2, receivedAwaitingDispatch: 3, dispatched: 4, completed: 5, exceptions: 0 };
function request(body: unknown = {}, cookies = `parcelops_access=${token}`, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/session/operator/warehouse/parcels", { method: "POST", headers: { Cookie: cookies, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue(operatorUser); expressAuth.mockResolvedValue({ success: true, data: overview }); });
it("forwards overview to a fixed GET with server-held tokens, no browser credentials in response", async () => {
  const response = await warehouseSession(request()); expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/warehouse/overview", undefined, token);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("validates and forwards warehouse filters and strips unexpected response fields", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { orders: [{ ...parcel, warehouseState: "UNASSIGNED", assignment: null, account: { passwordHash: "secret" } }], pagination: { page: 2, pageSize: 10, total: 1, totalPages: 1 } } });
  const response = await warehouseSession(request({ page: 2, pageSize: 10, warehouseState: "UNASSIGNED", search: "Test", township: "Tamwe", createdDate: "2026-10-22" }), true);
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/warehouse/parcels?page=2&pageSize=10&search=Test&township=Tamwe&createdDate=2026-10-22&warehouseState=UNASSIGNED", undefined, token);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
});
it.each(["SME", "RIDER"])("denies trusted %s role before backend access", async role => {
  currentProfile.mockResolvedValue({ ...operatorUser, role });
  for (const list of [false, true]) expect((await warehouseSession(request(), list)).status).toBe(403);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("rejects anonymous, cross-site, invalid filters and identity/status overrides", async () => {
  expect((await warehouseSession(request({}, ""))).status).toBe(401);
  expect((await warehouseSession(request({}, undefined, "https://evil.example"))).status).toBe(403);
  for (const body of [{ role: "OPERATOR" }, { ownerId: operatorUser.id }, { operatorId: operatorUser.id }, { warehouseState: "CREATED" }, { status: "CREATED" }, { page: 0 }]) expect((await warehouseSession(request(body), true)).status).toBe(400);
  expect((await warehouseSession(request({ search: "Test" }))).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});
it.each([401, 403, 404, 409, 500, 503])("preserves HTTP %s without clearing valid cookies for service failures", async status => {
  expressAuth.mockRejectedValue(new SessionError(status, "SERVICE_UNAVAILABLE"));
  const response = await warehouseSession(request()); expect(response.status).toBe(status);
  expect(response.cookies.get("parcelops_access")?.value).toBe(status === 401 ? "" : undefined);
});
it("rejects malformed or internally inconsistent overview totals", async () => {
  for (const data of [{ ...overview, receivedAwaitingDispatch: 999 }, { ...overview, unassigned: -1 }, {}]) {
    expressAuth.mockResolvedValue({ success: true, data }); expect((await warehouseSession(request())).status).toBe(502);
  }
});
