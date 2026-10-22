// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
const { currentProfile, expressAuth } = vi.hoisted(() => ({ currentProfile: vi.fn(), expressAuth: vi.fn() }));
vi.mock("@/features/auth/server/express-auth", async original => ({ ...await original<object>(), currentProfile, expressAuth }));
import { incidentsSession } from "@/features/incidents/server/incidents.session";
import { SessionError } from "@/features/auth/server/express-auth";
import { operatorUser } from "./fixtures/operator-orders";
import { riderUser } from "./fixtures/deliveries";
import { incident, incidentList, reviewedIncident } from "./fixtures/incidents";

const token = "a".repeat(43);
const input = { assignmentId: incident.assignmentId, type: "DAMAGED", reason: "Parcel arrived crushed", description: "Outer carton torn." };

function request(body: unknown = {}, cookies = `parcelops_access=${token}`, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/session/rider/incidents", { method: "POST", headers: { Cookie: cookies, Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  currentProfile.mockResolvedValue(riderUser);
  expressAuth.mockResolvedValue({ success: true, data: incident });
});

it("forwards strict Rider incident creation to the fixed backend path", async () => {
  const response = await incidentsSession(request(input), "create");
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/rider/incidents", input, token, undefined);
});
it("rejects identity, ownership, status and review-field injection before forwarding", async () => {
  const bodies = [
    { ...input, orderId: incident.orderId }, { ...input, riderId: riderUser.id }, { ...input, providerId: incident.providerId },
    { ...input, status: "REVIEWED" }, { ...input, reviewedById: operatorUser.id }, { ...input, type: "WET" },
    { ...input, reason: "ab" }, { ...input, description: "   " }, { assignmentId: "../auth" },
  ];
  for (const body of bodies) expect((await incidentsSession(request(body), "create")).status).toBe(400);
  expect(expressAuth).not.toHaveBeenCalled();
});
it("list and detail use authenticated Rider scope, fixed paths and strict inputs", async () => {
  expressAuth.mockResolvedValue({ success: true, data: incidentList });
  expect((await incidentsSession(request({ page: 1, pageSize: 20 }), "riderList")).status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/rider/incidents?page=1&pageSize=20", undefined, token, undefined);
  expect((await incidentsSession(request({ page: 1, pageSize: 20, status: "OPEN" }), "riderList")).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith("/api/rider/incidents?page=1&pageSize=20&status=OPEN", undefined, token, undefined);
  expressAuth.mockResolvedValue({ success: true, data: incident });
  expect((await incidentsSession(request({ id: incident.id }), "riderDetail")).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith(`/api/rider/incidents/${incident.id}`, undefined, token, undefined);
  for (const body of [{ page: 0 }, { pageSize: 101 }, { status: "CLOSED" }, { riderId: riderUser.id }, { id: "../auth" }]) {
    expect((await incidentsSession(request(body), "riderList")).status).toBe(400);
  }
});
it("denies the wrong role before backend access", async () => {
  for (const operation of ["create", "riderList", "riderDetail"] as const) {
    currentProfile.mockResolvedValue(operatorUser);
    expect((await incidentsSession(request(input), operation)).status).toBe(403);
  }
  for (const operation of ["operatorList", "operatorDetail", "review"] as const) {
    currentProfile.mockResolvedValue(riderUser);
    expect((await incidentsSession(request({ id: incident.id }), operation)).status).toBe(403);
  }
  expect(expressAuth).not.toHaveBeenCalled();
});
it("rejects foreign Rider data from the backend", async () => {
  expressAuth.mockResolvedValue({ success: true, data: { ...incident, riderId: operatorUser.id } });
  expect((await incidentsSession(request({ id: incident.id }), "riderDetail")).status).toBe(502);
  expressAuth.mockResolvedValue({ success: true, data: { ...incidentList, incidents: [{ ...incident, riderId: operatorUser.id }] } });
  expect((await incidentsSession(request({ page: 1, pageSize: 20 }), "riderList")).status).toBe(502);
});
it("operator list and detail use provider-scoped fixed paths", async () => {
  currentProfile.mockResolvedValue(operatorUser);
  expressAuth.mockResolvedValue({ success: true, data: incidentList });
  expect((await incidentsSession(request({ page: 2, pageSize: 10, status: "OPEN" }), "operatorList")).status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith("/api/operator/incidents?page=2&pageSize=10&status=OPEN", undefined, token, undefined);
  expressAuth.mockResolvedValue({ success: true, data: incident });
  expect((await incidentsSession(request({ id: incident.id }), "operatorDetail")).status).toBe(200);
  expect(expressAuth).toHaveBeenLastCalledWith(`/api/operator/incidents/${incident.id}`, undefined, token, undefined);
});
it("review forwards only the fixed REVIEWED status over PATCH", async () => {
  currentProfile.mockResolvedValue(operatorUser);
  expressAuth.mockResolvedValue({ success: true, data: reviewedIncident });
  const response = await incidentsSession(request({ id: incident.id, status: "REVIEWED" }), "review");
  expect(response.status).toBe(200);
  expect(expressAuth).toHaveBeenCalledWith(`/api/operator/incidents/${incident.id}/review`, { status: "REVIEWED" }, token, "PATCH");
  for (const body of [{ id: incident.id, status: "OPEN" }, { id: incident.id, status: "REVIEWED", reviewedById: operatorUser.id }, { id: incident.id }]) {
    expect((await incidentsSession(request(body), "review")).status).toBe(400);
  }
});
it("rejects anonymous and cross-site requests", async () => {
  expect((await incidentsSession(request({}, ""), "riderList")).status).toBe(401);
  expect((await incidentsSession(request({}, undefined, "https://evil.example"), "riderList")).status).toBe(403);
  expect(expressAuth).not.toHaveBeenCalled();
});
it.each([401, 403, 404, 409, 500, 503])("preserves HTTP %s and clears cookies only for 401", async status => {
  expressAuth.mockRejectedValue(new SessionError(status, "SERVICE_UNAVAILABLE"));
  const response = await incidentsSession(request(input), "create");
  expect(response.status).toBe(status);
  expect(response.cookies.get("parcelops_access")?.value).toBe(status === 401 ? "" : undefined);
});
