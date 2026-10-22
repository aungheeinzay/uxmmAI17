import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RiderDeliveryDetails } from "@/features/deliveries/components/rider-delivery-details";
import { RiderDashboard } from "@/features/deliveries/components/rider-dashboard";
import { RiderIncidents } from "@/features/incidents/components/rider-incidents";
import { OperatorIncidents } from "@/features/incidents/components/operator-incidents";
import { OperatorIncidentDetail } from "@/features/incidents/components/operator-incident-detail";
import { useAuthStore } from "@/stores/auth.store";
import { operatorUser } from "./fixtures/operator-orders";
import { assignment, assignments, riderUser } from "./fixtures/deliveries";
import { incident, incidentList, reviewedIncident } from "./fixtures/incidents";

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const ok = (data: unknown) => reply({ success: true, data });
const reviewBody = { assignmentId: assignment.id, type: "DAMAGED", reason: "Parcel arrived crushed", description: "Outer carton torn on one corner." };

beforeEach(() => {
  useAuthStore.getState().setUser(riderUser);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok(assignment)));
});
afterEach(() => {
  cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: "loading", revision: 0 });
});

it("reports an incident from an assigned delivery with the trusted assignment id only", async () => {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/rider/incidents")) {
      const body = JSON.parse(init!.body as string);
      expect(body).toEqual(reviewBody);
      return ok(incident);
    }
    return ok(assignment);
  });
  render(<RiderDeliveryDetails id={assignment.id} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Report Incident" }));
  await user.type(await screen.findByLabelText("Reason"), "Parcel arrived crushed");
  await user.type(screen.getByLabelText("Short description"), "Outer carton torn on one corner.");
  await user.click(screen.getByRole("button", { name: "Submit incident" }));
  expect(await screen.findByText(/Incident reported/)).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith("/rider/incidents"))).toHaveLength(1);
});

it("explains duplicate reports and keeps the form available", async () => {
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith("/rider/incidents")
    ? reply({ success: false, error: { code: "INCIDENT_ALREADY_REPORTED" } }, 409)
    : ok(assignment));
  render(<RiderDeliveryDetails id={assignment.id} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Report Incident" }));
  await user.type(await screen.findByLabelText("Reason"), "Parcel arrived crushed");
  await user.type(screen.getByLabelText("Short description"), "Outer carton torn.");
  await user.click(screen.getByRole("button", { name: "Submit incident" }));
  expect((await screen.findByRole("alert")).textContent).toContain("already has a report");
  expect(screen.getByLabelText("Reason")).toBeTruthy();
});

it("blocks an empty report before any network request", async () => {
  render(<RiderDeliveryDetails id={assignment.id} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Report Incident" }));
  await user.click(screen.getByRole("button", { name: "Submit incident" }));
  expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).endsWith("/rider/incidents"))).toBe(false);
});

it("links Riders to their incident history from the dashboard", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok(assignments));
  render(<RiderDashboard />);
  const link = await screen.findByRole("link", { name: /Incidents/ });
  expect(link.getAttribute("href")).toBe("/rider/incidents");
});

it("shows a Rider's own incidents with type, status and delivery link", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok(incidentList));
  render(<RiderIncidents />);
  expect(await screen.findByText(incident.order.orderCode)).toBeTruthy();
  expect(screen.getAllByText("Damaged").length).toBeGreaterThan(0);
  expect(screen.getByText("Unresolved")).toBeTruthy();
  expect(screen.getByText("Parcel arrived crushed")).toBeTruthy();
  expect(screen.getByRole("link", { name: "View delivery" }).getAttribute("href")).toBe(`/rider/assignments/${assignment.id}`);
});

it("lists provider incidents and links Operators to the full report", async () => {
  useAuthStore.getState().setUser(operatorUser);
  vi.mocked(fetch).mockImplementation(async () => ok(incidentList));
  render(<OperatorIncidents />);
  expect(await screen.findByText(incident.order.orderCode)).toBeTruthy();
  expect(screen.getAllByText("Unresolved").length).toBeGreaterThan(0);
  expect(screen.getByRole("link", { name: /Open report/ }).getAttribute("href")).toBe(`/operator/incidents/${incident.id}`);
});

it("reviews an incident from its detail page and never changes the order status", async () => {
  useAuthStore.getState().setUser(operatorUser);
  let current = incident;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (String(input).endsWith("/review")) {
      expect(JSON.parse(init!.body as string)).toEqual({ id: incident.id, status: "REVIEWED" });
      current = reviewedIncident;
      return ok(reviewedIncident);
    }
    return ok(current);
  });
  render(<OperatorIncidentDetail id={incident.id} />);
  expect(await screen.findByText(incident.reason)).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Mark as reviewed" }));
  expect(await screen.findByText(/This incident was reviewed/)).toBeTruthy();
  expect(screen.getByText("Picked up")).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).includes("/status"))).toBe(false);
});

it("renders a reviewed incident without offering a second review", async () => {
  useAuthStore.getState().setUser(operatorUser);
  vi.mocked(fetch).mockImplementation(async () => ok(reviewedIncident));
  render(<OperatorIncidentDetail id={incident.id} />);
  await screen.findByText(/This incident was reviewed/);
  expect(screen.queryByRole("button", { name: "Mark as reviewed" })).toBeNull();
  await waitFor(() => expect(screen.getAllByText("Reviewed").length).toBeGreaterThan(0));
});
