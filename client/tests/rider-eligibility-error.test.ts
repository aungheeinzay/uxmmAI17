// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/server/express-auth", async original => ({ ...await original<object>(), currentProfile: vi.fn(async () => ({ id: "550e8400-e29b-41d4-a716-446655440000", role: "OPERATOR", fullName: "Test Operator", phone: null })) }));
import { expressAuth, SessionError } from "@/features/auth/server/express-auth";
import { deliveriesSession } from "@/features/deliveries/server/deliveries.session";
import { ApiError } from "@/lib/api-client";
import { deliveryError } from "@/features/deliveries/api/deliveries.api";
afterEach(() => vi.unstubAllGlobals());
function fail() { vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: false, error: { code: "RIDER_NOT_ELIGIBLE", message: "PRIVATE_SERVER_DETAIL" } }), { status: 404 }))); }
it("preserves the known eligibility error through actual Express transport without exposing server details", async () => {
  fail();
  await expect(expressAuth("/api/operator/assignments", {}, "a".repeat(43))).rejects.toMatchObject({ status: 404, code: "RIDER_NOT_ELIGIBLE" });
  try { await expressAuth("/api/operator/assignments", {}); } catch (error) { expect(error).toBeInstanceOf(SessionError); expect((error as Error).message).not.toContain("PRIVATE"); }
  expect(deliveryError(new ApiError(404, "RIDER_NOT_ELIGIBLE"))).toBe("An activated Rider account was not found.");
});
it("preserves eligibility code/status through the real session bridge for assignment failure", async () => {
  fail();
  const request = new NextRequest("http://localhost:3000/api/session/operator/assignments/create", { method: "POST", headers: { Origin: "http://localhost:3000", Cookie: `parcelops_access=${"a".repeat(43)}`, "Content-Type": "application/json" }, body: JSON.stringify({ orderId: "660e8400-e29b-41d4-a716-446655440000", riderId: "770e8400-e29b-41d4-a716-446655440000" }) });
  const response = await deliveriesSession(request, "create");
  expect(response.status).toBe(404); expect((await response.json()).error.code).toBe("RIDER_NOT_ELIGIBLE");
  expect(response.cookies.get("parcelops_access")).toBeUndefined();
});
