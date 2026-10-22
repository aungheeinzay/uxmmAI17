// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth, exchangeTokens } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn(), exchangeTokens: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async importOriginal => ({ ...await importOriginal<object>(), currentProfile, expressAuth, exchangeTokens }));
import { riderManagementSession } from "@/features/riders/server/rider-management.session";
import { operatorUser } from "./fixtures/operator-orders";
const token = "a".repeat(43), id = "550e8400-e29b-41d4-a716-446655440000";
function request(body: unknown, cookie = `parcelops_access=${token}`, origin = "http://localhost:3000") { return new NextRequest("http://localhost:3000/api/session/operator/rider-management", { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue(operatorUser); });
it("requires trusted Operator session and origin, and rejects scope injection", async () => {
  const body = { action: "list", query: { page: 1, pageSize: 20 } };
  expect((await riderManagementSession(request(body, ""))).status).toBe(401);
  expect((await riderManagementSession(request(body, undefined, "https://evil.example"))).status).toBe(403);
  for (const role of ["SME", "RIDER"]) { currentProfile.mockResolvedValue({ ...operatorUser, role }); expect((await riderManagementSession(request(body))).status).toBe(403); }
  currentProfile.mockResolvedValue(operatorUser);
  expect((await riderManagementSession(request({ ...body, query: { ...body.query, providerId: id } }))).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("forwards fixed provider-scoped reads and pagination without browser tokens", async () => {
  const pagination = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
  expressAuth.mockImplementation(async (path: string) => ({ success: true, data: path.includes("overview") ? { totalRiders: 0, available: 0, assigned: 0, delivering: 0, inactive: 0 } : path.includes("invitations") ? { invitations: [], pagination } : { riders: [], pagination } }));
  const result = await riderManagementSession(request({ action: "list", query: { page: 1, pageSize: 20, search: "One", workload: "DELIVERING" }, invitationPage: 2, invitationPageSize: 5 }));
  expect(result.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/riders?page=1&pageSize=20&search=One&workload=DELIVERING", undefined, token);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/riders/invitations?page=2&pageSize=5", undefined, token);
  expect(JSON.stringify(await result.json())).not.toContain(token);
});
it("rejects malformed backend detail contracts", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { passwordHash: "private" } });
  expect((await riderManagementSession(request({ action: "detail", id, page: 1 }))).status).toBe(502);
});
const managedRider = { id, fullName: "Rider One", phone: null, email: "rider@example.test", providerId: id, provider: { id, name: "Provider" }, accountStatus: "ACTIVATED", isActive: true, deactivatedAt: null, vehicle: { type: null, plateNumber: null, model: null, color: null }, profileComplete: false, missingFields: ["phone"], completedAt: null, workload: "AVAILABLE", assignedTaskCount: 0, inProgressDeliveryCount: 0, activeAssignedTaskCount: 0, completedDeliveryCount: 0 };
it("forwards the selected assignment page size", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { rider: managedRider, assignments: [], pagination: { page: 2, pageSize: 5, total: 0, totalPages: 0 } } });
  expect((await riderManagementSession(request({ action: "detail", id, page: 2, pageSize: 5 }))).status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith(`/api/operator/riders/${id}?page=2&pageSize=5`, undefined, token);
});
it("forwards allowlisted edit and status actions to fixed provider-scoped PATCH paths", async () => {
  expressAuth.mockImplementation(async () => ({ success: true, data: { rider: managedRider } }));
  const input = { fullName: "Rider One", phone: "09123456789", vehicleType: "MOTORCYCLE", vehiclePlateNumber: "ABC-123" };
  const updated = await riderManagementSession(request({ action: "update", id, input }));
  expect(updated.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith(`/api/operator/riders/${id}`, input, token, "PATCH");
  const deactivated = await riderManagementSession(request({ action: "deactivate", id }));
  expect(deactivated.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith(`/api/operator/riders/${id}/deactivate`, {}, token, "PATCH");
  const reactivated = await riderManagementSession(request({ action: "reactivate", id }));
  expect(reactivated.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith(`/api/operator/riders/${id}/reactivate`, {}, token, "PATCH");
});
it("rejects protected fields and mismatched Rider responses", async () => {
  expect((await riderManagementSession(request({ action: "update", id, input: { fullName: "Rider One", phone: "09123456789", vehicleType: "BICYCLE", providerId: id } }))).status).toBe(400);
  expect((await riderManagementSession(request({ action: "deactivate", id, role: "OPERATOR" }))).status).toBe(400);
  expressAuth.mockResolvedValue({ success: true, data: { rider: { ...managedRider, id: "770e8400-e29b-41d4-a716-446655440000" } } });
  expect((await riderManagementSession(request({ action: "deactivate", id }))).status).toBe(502);
});
