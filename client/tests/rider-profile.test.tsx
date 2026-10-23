import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/rider" }));
import { RiderProfileGate } from "@/features/rider-profile/components/rider-profile-gate";
import { RiderProfileForm } from "@/features/rider-profile/components/rider-profile-form";
import { RiderDashboard } from "@/features/deliveries/components/rider-dashboard";
import { useAuthStore } from "@/stores/auth.store";
import { assignment, riderUser } from "./fixtures/deliveries";
import type { RiderProfile } from "@/features/rider-profile/types/rider-profile.types";

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const ok = (data: unknown) => reply({ success: true, data });

const incomplete: RiderProfile = {
  fullName: "Test Rider", phone: "09 123 456 789", email: "rider@example.com",
  provider: { id: "7c9e6679-7425-40de-944b-e07fc1f90ae7", name: "Example Provider" },
  vehicle: { type: "MOTORCYCLE", plateNumber: "ABC-123", model: null, color: null },
  profileComplete: false, missingFields: ["vehicleType"], completedAt: null,
};
const complete: RiderProfile = { ...incomplete, profileComplete: true, missingFields: [], completedAt: "2026-10-22T03:00:00.000Z" };

beforeEach(() => {
  useAuthStore.getState().setUser(riderUser);
  replace.mockClear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(complete)));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: "loading", revision: 0 });
});

it("lets a complete Rider into the delivery area", async () => {
  render(<RiderProfileGate><p>Deliveries ready</p></RiderProfileGate>);
  expect(await screen.findByText("Deliveries ready")).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});

it("redirects a confirmed incomplete Rider to profile completion", async () => {
  vi.mocked(fetch).mockResolvedValue(ok(incomplete));
  render(<RiderProfileGate><p>Deliveries ready</p></RiderProfileGate>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/rider/complete-profile"));
  expect(screen.queryByText("Deliveries ready")).toBeNull();
});

it("shows provider setup required without a redirect loop", async () => {
  vi.mocked(fetch).mockResolvedValue(ok({ ...incomplete, provider: null, missingFields: ["provider"] }));
  render(<RiderProfileGate><p>Deliveries ready</p></RiderProfileGate>);
  expect(await screen.findByText("Delivery provider setup required")).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});

it("does not treat a 5xx outage as an incomplete profile", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ success: false, error: { code: "SERVICE_UNAVAILABLE" } }, 503));
  render(<RiderProfileGate><p>Deliveries ready</p></RiderProfileGate>);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("couldn’t check your Rider profile");
  expect(alert.textContent).toContain("not treated as incomplete");
  expect(replace).not.toHaveBeenCalled();
});

it("describes an invalid profile response without claiming the service is unreachable", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: { invalid: true } }, 200));
  render(<RiderProfileGate><p>Deliveries ready</p></RiderProfileGate>);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("response was unexpected");
  expect(alert.textContent).not.toContain("could not reach");
  expect(alert.textContent).toContain("not treated as incomplete");
  expect(replace).not.toHaveBeenCalled();
});

it("prefills data, conditionally requires a plate and saves only after confirmation", async () => {
  vi.mocked(fetch).mockImplementation(async input => {
    if (String(input).endsWith("/profile/update")) return ok({ ...complete, vehicle: { ...complete.vehicle, type: "BICYCLE", plateNumber: null } });
    return ok(incomplete);
  });
  render(<RiderProfileForm />);
  const user = userEvent.setup();
  expect(((await screen.findByLabelText("Full name")) as HTMLInputElement).value).toBe("Test Rider");
  expect(screen.getByLabelText("Vehicle plate number")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Vehicle type"), "BICYCLE");
  expect(screen.queryByLabelText("Vehicle plate number")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Save and Continue" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/rider"));
  const call = vi.mocked(fetch).mock.calls.find(item => String(item[0]).endsWith("/profile/update"))!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({ fullName: "Test Rider", phone: "09 123 456 789", vehicleType: "BICYCLE" });
});

it("shows field errors and never saves invalid values", async () => {
  vi.mocked(fetch).mockResolvedValue(ok({ ...incomplete, fullName: "", phone: "", vehicle: { ...incomplete.vehicle, type: null } }));
  render(<RiderProfileForm />);
  const user = userEvent.setup();
  await screen.findByLabelText("Full name");
  await user.click(screen.getByRole("button", { name: "Save and Continue" }));
  expect(await screen.findByText("Enter your full name.")).toBeTruthy();
  expect(screen.getByText("Enter your phone number.")).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.some(item => String(item[0]).endsWith("/profile/update"))).toBe(false);
  expect(replace).not.toHaveBeenCalled();
});

it("does not redirect while provider membership is still missing", async () => {
  const noProvider = { ...complete, provider: null, profileComplete: false, missingFields: ["provider"] };
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith("/profile/update") ? ok(noProvider) : ok(noProvider));
  render(<RiderProfileForm />);
  const user = userEvent.setup();
  await screen.findByLabelText("Full name");
  await user.click(screen.getByRole("button", { name: "Save and Continue" }));
  expect(await screen.findByText(/Profile saved, but setup is incomplete/)).toBeTruthy();
  expect(replace).not.toHaveBeenCalled();
});

it("reports network failures without claiming completion", async () => {
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith("/profile/update")
    ? reply({ success: false, error: { code: "SERVICE_UNAVAILABLE" } }, 503)
    : ok(incomplete));
  render(<RiderProfileForm />);
  const user = userEvent.setup();
  await screen.findByLabelText("Full name");
  await user.click(screen.getByRole("button", { name: "Save and Continue" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("could not reach the Rider service");
  expect(replace).not.toHaveBeenCalled();
});

it("renders real active and completed deliveries with an honest QR entry point", async () => {
  const active = structuredClone(assignment);
  active.order.status = "PICKED_UP";
  active.order.recipientName = "Active Recipient";
  const done = structuredClone(assignment);
  done.id = "bb0e8400-e29b-41d4-a716-446655440000";
  done.order.orderCode = "ORD-COMPLETE-1";
  done.order.recipientName = "Completed Recipient";
  done.order.status = "DELIVERED";
  const counts = {
    active: { all: 1, PICKED_UP: 1, IN_TRANSIT: 0, OUT_FOR_DELIVERY: 0 },
    completed: { all: 1, DELIVERED: 1, FAILED: 0, CANCELLED: 0 },
  };
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    const body = JSON.parse(init!.body as string) as { group?: string };
    const assignments = body.group === "completed" ? [done] : [active];
    return ok({ assignments, pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, counts });
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("Active Recipient")).toBeTruthy();
  expect(screen.queryByText("Completed Recipient")).toBeNull();
  await user.click(screen.getByRole("tab", { name: /Completed/ }));
  expect(await screen.findByText("Completed Recipient")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Scan Parcel QR Code/ }));
  expect(await screen.findByRole("heading", { name: "Scan Parcel QR Code" })).toBeTruthy();
  expect(screen.queryByText("Verify custody")).toBeNull();
  expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).endsWith("/status"))).toBe(false);
});
