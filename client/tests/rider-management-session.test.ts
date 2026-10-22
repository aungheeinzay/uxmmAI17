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
  expressAuth.mockImplementation(async (path: string) => ({ success: true, data: path.includes("overview") ? { totalRiders: 0, available: 0, assigned: 0, delivering: 0 } : path.includes("invitations") ? { invitations: [], pagination } : { riders: [], pagination } }));
  const result = await riderManagementSession(request({ action: "list", query: { page: 1, pageSize: 20, search: "One", workload: "DELIVERING" }, invitationPage: 2 }));
  expect(result.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/riders?page=1&pageSize=20&search=One&workload=DELIVERING", undefined, token);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/riders/invitations?page=2&pageSize=10", undefined, token);
  expect(JSON.stringify(await result.json())).not.toContain(token);
});
it("rejects malformed backend detail contracts", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { passwordHash: "private" } });
  expect((await riderManagementSession(request({ action: "detail", id, page: 1 }))).status).toBe(502);
});
