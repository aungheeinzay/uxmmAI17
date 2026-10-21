// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth, exchangeTokens } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn(), exchangeTokens: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async (importOriginal) => ({ ...await importOriginal<object>(), currentProfile, expressAuth, exchangeTokens }));
import { updateProfileSession } from "@/features/auth/server/session";
import { SessionError } from "@/features/auth/server/express-auth";
const user = { id: "550e8400-e29b-41d4-a716-446655440000", role: "OPERATOR", fullName: "Test", phone: null };
function request(body: unknown, cookies = "parcelops_access=" + "a".repeat(43), origin = "http://localhost:3000") { return new NextRequest("http://localhost:3000/api/session/profile", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookies }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); currentProfile.mockResolvedValue(user); expressAuth.mockResolvedValue({ success: true, data: { ...user, fullName: "Updated", extra: "filtered" } }); });
it("forwards authenticated PATCH to the fixed profile endpoint and strips extra fields", async () => {
 const result = await updateProfileSession(request({ fullName: "Updated" })); expect(result.status).toBe(200);
 expect(expressAuth).toHaveBeenCalledWith("/api/users/me", { fullName: "Updated" }, "a".repeat(43), "PATCH");
 expect(await result.json()).toEqual({ success: true, data: { user: { ...user, fullName: "Updated" } } }); expect(result.headers.get("Cache-Control")).toContain("no-store");
});
it.each([{ role: "RIDER" }, { email: "other@example.com" }, {}, { phone: "x".repeat(33) }])("rejects invalid input %j", async (body) => { expect((await updateProfileSession(request(body))).status).toBe(400); expect(expressAuth).not.toHaveBeenCalled(); });
it("blocks anonymous and cross-site updates", async () => { expect((await updateProfileSession(request({ fullName: "Name" }, ""))).status).toBe(401); expect((await updateProfileSession(request({ fullName: "Name" }, "", "https://evil.example"))).status).toBe(403); expect(expressAuth).not.toHaveBeenCalled(); });
it("rejects unexpected identity or role in update responses", async () => { expressAuth.mockResolvedValue({ success: true, data: { ...user, role: "SME" } }); expect((await updateProfileSession(request({ fullName: "Name" }))).status).toBe(502); });
it("preserves rotated cookies when a profile update fails", async () => {
 exchangeTokens.mockResolvedValue({ accessToken: "b".repeat(43), refreshToken: "c".repeat(43), expiresIn: 900, user: { id: user.id, email: "test@example.com" } });
 expressAuth.mockRejectedValue(new SessionError(503, "SERVICE_UNAVAILABLE"));
 const result = await updateProfileSession(request({ phone: null }, "parcelops_refresh=" + "d".repeat(43))); expect(result.status).toBe(503); expect(result.cookies.get("parcelops_access")?.value).toBe("b".repeat(43));
});
