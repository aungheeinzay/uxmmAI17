// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async (importOriginal) => ({ ...await importOriginal<object>(), currentProfile, expressAuth }));
import { inviteRiderSession } from "@/features/auth/server/session";
const token = "a".repeat(43);
const id = "550e8400-e29b-41d4-a716-446655440000";
function request(body: unknown = { email: "rider@example.com" }, origin = "http://localhost:3000") { return new NextRequest("http://localhost:3000/api/session/riders/invitations", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: `parcelops_access=${token}` }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue({ id, role: "OPERATOR", fullName: null, phone: null }); expressAuth.mockResolvedValue({ success: true, data: { message: "Sent", invitation: { id, email: "rider@example.com", expiresAt: new Date().toISOString(), status: "pending" }, token: "must-not-leak" } }); });
it.each(["SME", "RIDER"])("blocks %s before forwarding", async (role) => { currentProfile.mockResolvedValue({ id, role }); expect((await inviteRiderSession(request())).status).toBe(403); expect(expressAuth).not.toHaveBeenCalled(); });
it("forwards only a fixed backend endpoint with server-held credentials and filters output", async () => { const response = await inviteRiderSession(request()); expect(response.status).toBe(201); expect(expressAuth).toHaveBeenCalledWith("/api/riders/invitations", { email: "rider@example.com" }, token); expect(JSON.stringify(await response.json())).not.toContain("must-not-leak"); });
it("rejects role injection and cross-site submissions", async () => { expect((await inviteRiderSession(request({ email: "rider@example.com", role: "RIDER" }))).status).toBe(400); expect((await inviteRiderSession(request({}, "https://evil.example"))).status).toBe(403); expect(expressAuth).not.toHaveBeenCalled(); });
