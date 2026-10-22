// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async original => ({ ...await original<object>(), currentProfile, expressAuth }));
import { deliveriesSession } from "@/features/deliveries/server/deliveries.session";
import { SessionError } from "@/features/auth/server/express-auth";
import { operatorUser } from "./fixtures/operator-orders";
import { assignment, assignments, riderUser } from "./fixtures/deliveries";
const token = "a".repeat(43);
function request(body: unknown = {}, cookies = `parcelops_access=${token}`, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/session/operator/assignments", { method: "POST", headers: { Cookie: cookies, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue(operatorUser); expressAuth.mockResolvedValue({ success: true, data: assignment }); });
it("creates assignments through fixed backend POST with no client actor identity", async () => {
  const input = { orderId: assignment.orderId, riderId: assignment.riderId };
  expect((await deliveriesSession(request(input), "create")).status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/assignments", input, token, undefined);
});
it.each(["riders", "operatorList", "create"] as const)("denies Rider and SME access to %s before forwarding", async operation => {
  for (const role of ["RIDER", "SME"]) {
    currentProfile.mockResolvedValue({ ...operatorUser, role });
    expect((await deliveriesSession(request(), operation)).status).toBe(403);
  }
  expect(expressAuth).not.toHaveBeenCalled();
});
it("requires cookies, same origin, strict pagination and identity-free inputs", async () => {
  expect((await deliveriesSession(request({}, ""), "operatorList")).status).toBe(401);
  expect((await deliveriesSession(request({}, undefined, "https://evil.example"), "operatorList")).status).toBe(403);
  for (const body of [{ page: 0 }, { pageSize: 101 }, { riderId: assignment.riderId }, { actorId: operatorUser.id }]) expect((await deliveriesSession(request(body), "operatorList")).status).toBe(400);
  expect((await deliveriesSession(request({ orderId: assignment.orderId, riderId: assignment.riderId, assignedById: operatorUser.id }), "create")).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("uses authenticated Rider scope and rejects unsafe/foreign backend responses", async () => {
  currentProfile.mockResolvedValue(riderUser);
  expressAuth.mockResolvedValue({ success: true, data: assignments });
  expect((await deliveriesSession(request({ page: 1, pageSize: 20 }), "riderList")).status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/rider/assignments?page=1&pageSize=20", undefined, token, undefined);
  expressAuth.mockResolvedValue({ success: true, data: { ...assignment, riderId: operatorUser.id } });
  expect((await deliveriesSession(request({ id: assignment.id }), "detail")).status).toBe(502);
});
it("forwards Rider group/status filters without accepting client identity", async () => {
  currentProfile.mockResolvedValue(riderUser);
  expressAuth.mockResolvedValue({ success: true, data: assignments });
  expect((await deliveriesSession(request({ page: 1, pageSize: 20, group: "completed" }), "riderList")).status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/rider/assignments?page=1&pageSize=20&group=completed", undefined, token, undefined);
  expressAuth.mockClear();
  expect((await deliveriesSession(request({ page: 1, pageSize: 20, group: "active", status: "IN_TRANSIT" }), "riderList")).status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/rider/assignments?page=1&pageSize=20&group=active&status=IN_TRANSIT", undefined, token, undefined);
  for (const body of [
    { group: "active", status: "DELIVERED" }, { group: "completed", status: "PICKED_UP" },
    { group: "other" }, { status: "UNKNOWN" }, { riderId: riderUser.id },
  ]) expect((await deliveriesSession(request(body), "riderList")).status).toBe(400);
});
it("forwards status PATCH and strips unexpected secret fields", async () => {
  currentProfile.mockResolvedValue(riderUser);
  expressAuth.mockResolvedValue({ success: true, data: { ...assignment, previousStatus: "PICKED_UP", secret: "private", order: { ...assignment.order, status: "IN_TRANSIT" } } });
  const response = await deliveriesSession(request({ id: assignment.id, status: "IN_TRANSIT" }), "status");
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith(`/api/rider/assignments/${assignment.id}/status`, { status: "IN_TRANSIT" }, token, "PATCH");
  expect(JSON.stringify(await response.json())).not.toContain("private");
  for (const body of [{ id: "../auth", status: "FAILED", note: "Test failure" }, { id: assignment.id, status: "FAILED", note: "  " }, { id: assignment.id, status: "DELIVERED", actorId: riderUser.id }]) expect((await deliveriesSession(request(body), "status")).status).toBe(400);
});
it.each([401, 403, 404, 409, 500, 503])("preserves HTTP %s and clears cookies only for 401", async status => {
  expressAuth.mockRejectedValue(new SessionError(status, "SERVICE_UNAVAILABLE"));
  const response = await deliveriesSession(request({ orderId: assignment.orderId, riderId: assignment.riderId }), "create");
  expect(response.status).toBe(status);
  expect(response.cookies.get("parcelops_access")?.value).toBe(status === 401 ? "" : undefined);
});
