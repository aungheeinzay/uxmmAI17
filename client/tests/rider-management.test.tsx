import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RiderManagement } from "@/features/riders/components/rider-management";
import { useAuthStore } from "@/stores/auth.store";
const id = "550e8400-e29b-41d4-a716-446655440000", providerId = "660e8400-e29b-41d4-a716-446655440000";
const rider = { id, fullName: "Rider One", email: "rider@example.test", phone: "09123456789", providerId, provider: { id: providerId, name: "Flash Deliver" }, accountStatus: "ACTIVATED", isActive: true, deactivatedAt: null, vehicle: { type: "MOTORCYCLE", plateNumber: "ABC-123", model: "125", color: "Black" }, profileComplete: true, missingFields: [], completedAt: "2026-10-22T00:00:00.000Z", workload: "DELIVERING", assignedTaskCount: 1, inProgressDeliveryCount: 2, activeAssignedTaskCount: 3, completedDeliveryCount: 4 };
const pagination = { page: 1, pageSize: 20, total: 1, totalPages: 1 };
const dashboard = { list: { riders: [rider], pagination }, overview: { totalRiders: 1, available: 0, assigned: 0, delivering: 1, inactive: 0 }, pending: { invitations: [], pagination: { ...pagination, total: 0, totalPages: 0 } } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });
function setup(data: unknown = dashboard, baseRider: Record<string, unknown> = rider) {
  useAuthStore.getState().setUser({ id, role: "OPERATOR", fullName: "Operator", phone: null });
  const fetcher = vi.fn().mockImplementation(async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.action === "detail") return new Response(JSON.stringify({ success: true, data: { rider: baseRider, assignments: [], pagination: { ...pagination, total: 0, totalPages: 0 } } }), { status: 200 });
    if (body.action === "update") {
      const input = body.input;
      const updated = { ...baseRider, fullName: input.fullName, phone: input.phone, vehicle: { type: input.vehicleType, plateNumber: input.vehiclePlateNumber ?? null, model: input.vehicleModel ?? null, color: input.vehicleColor ?? null } };
      return new Response(JSON.stringify({ success: true, data: { rider: updated } }), { status: 200 });
    }
    if (body.action === "deactivate" || body.action === "reactivate") {
      const updated = { ...baseRider, isActive: body.action === "reactivate", deactivatedAt: body.action === "deactivate" ? "2026-10-23T00:00:00.000Z" : null };
      return new Response(JSON.stringify({ success: true, data: { rider: updated } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher); render(<RiderManagement />); return fetcher;
}
it("renders real overview, workload and account state without presence claims", async () => {
  setup(); expect(await screen.findByText("Rider One")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Rider overview" })).toBeTruthy();
  expect(screen.getByText("Activated")).toBeTruthy(); expect(screen.getAllByText("Delivering").length).toBeGreaterThan(0);
  expect(screen.getByText(/not online presence/)).toBeTruthy(); expect(screen.getByRole("heading", { name: "Invite a Rider" })).toBeTruthy();
});
it("submits search, workload and pagination filters, and refreshes manually", async () => {
  const fetcher = setup(), user = userEvent.setup(); await screen.findByText("Rider One");
  await user.type(screen.getByLabelText("Search Riders"), "One"); await user.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => JSON.parse(call[1].body).query.search === "One")).toBe(true));
  await screen.findByText("Rider One"); await user.selectOptions(screen.getByLabelText("Workload"), "AVAILABLE");
  await waitFor(() => expect(fetcher.mock.calls.some(call => JSON.parse(call[1].body).query.workload === "AVAILABLE")).toBe(true));
  const before = fetcher.mock.calls.length; await user.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(before));
});
it("keeps the current table visible while a debounced search is loading", async () => {
  const fetcher = setup(), user = userEvent.setup(); await screen.findByText("Rider One");
  const before = fetcher.mock.calls.length;
  let release: ((response: Response) => void) | undefined;
  fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
  await user.type(screen.getByLabelText("Search Riders"), "One");
  await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThan(before), { timeout: 2000 });
  expect(screen.getByText("Rider One")).toBeTruthy();
  expect(screen.getByText("Updating Riders…")).toBeTruthy();
  release!(new Response(JSON.stringify({ success: true, data: dashboard }), { status: 200 }));
  await waitFor(() => expect(screen.queryByText("Updating Riders…")).toBeNull());
});
it("changes Rider and invitation page sizes", async () => {
  const fetcher = setup(), user = userEvent.setup(); await screen.findByText("Rider One");
  await user.selectOptions(screen.getByLabelText("Riders per page"), "5");
  await waitFor(() => expect(fetcher.mock.calls.some(call => { const body = JSON.parse(call[1].body); return body.action === "list" && body.query.pageSize === 5 && body.query.page === 1; })).toBe(true));
  await user.selectOptions(screen.getByLabelText("Invitations per page"), "5");
  await waitFor(() => expect(fetcher.mock.calls.some(call => { const body = JSON.parse(call[1].body); return body.action === "list" && body.invitationPageSize === 5 && body.invitationPage === 1; })).toBe(true));
});
it("opens provider-scoped Rider detail with delivered summary and assignments empty state", async () => {
  const fetcher = setup(), user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "View Rider One details" }));
  expect((await screen.findAllByText("Flash Deliver")).length).toBeGreaterThan(0); expect(screen.getByText(/4 delivered/)).toBeTruthy(); expect(screen.getByText("No assigned parcels.")).toBeTruthy();
  expect(fetcher.mock.calls.some(call => JSON.parse(call[1].body).id === id)).toBe(true);
  await user.click(screen.getByRole("button", { name: "Close details" })); expect(screen.queryByRole("region", { name: "Rider details" })).toBeNull();
});
it("shows separate pending invitees and empty Riders without counting them as active Riders", async () => {
  setup({ ...dashboard, list: { riders: [], pagination: { ...pagination, total: 0, totalPages: 0 } }, overview: { totalRiders: 0, available: 0, assigned: 0, delivering: 0, inactive: 0 }, pending: { invitations: [{ id, email: "pending@example.test", fullName: "Pending Rider", createdAt: "2026-10-22T00:00:00Z", expiresAt: "2026-10-23T00:00:00Z" }], pagination } });
  expect(await screen.findByText(/No Riders in your provider yet/)).toBeTruthy(); expect(screen.getByText(/pending@example.test/)).toBeTruthy();
});
it("handles loading, filtered empty results, errors and missing membership", async () => {
  const fetcher = setup({ ...dashboard, list: { riders: [], pagination: { ...pagination, total: 0, totalPages: 0 } } });
  expect(screen.getByRole("status").textContent).toMatch(/Loading/); expect(await screen.findByText("No Riders match your filters.")).toBeTruthy();
  fetcher.mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "PROVIDER_MEMBERSHIP_REQUIRED" } }), { status: 409 }));
  await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByText("Your delivery provider has not been configured.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Send invitation" })).toBeNull();
});
it("edits a Rider through the live API, prepopulates fields and refreshes the list", async () => {
  const fetcher = setup(), user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "View Rider One details" }));
  await user.click(await screen.findByRole("button", { name: "Edit Rider" }));
  const dialog = await screen.findByRole("dialog");
  expect((within(dialog).getByLabelText("Full name") as HTMLInputElement).value).toBe("Rider One");
  expect((within(dialog).getByLabelText("Vehicle plate number") as HTMLInputElement).value).toBe("ABC-123");
  await user.clear(within(dialog).getByLabelText("Full name")); await user.type(within(dialog).getByLabelText("Full name"), "Rider Updated");
  await user.click(within(dialog).getByRole("button", { name: "Save Rider" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => { const body = JSON.parse(call[1].body); return body.action === "update" && body.input.fullName === "Rider Updated"; })).toBe(true));
  expect(await screen.findByText(/Rider details updated/)).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("rejects motor vehicles without a plate before calling the API", async () => {
  const fetcher = setup(), user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "View Rider One details" }));
  await user.click(await screen.findByRole("button", { name: "Edit Rider" }));
  const dialog = await screen.findByRole("dialog");
  await user.selectOptions(within(dialog).getByLabelText("Vehicle type"), "CAR");
  await user.clear(within(dialog).getByLabelText("Vehicle plate number"));
  await user.click(within(dialog).getByRole("button", { name: "Save Rider" }));
  expect(await within(dialog).findByText("A plate number is required for motorcycles, cars and vans.")).toBeTruthy();
  expect(fetcher.mock.calls.some(call => JSON.parse(call[1].body).action === "update")).toBe(false);
});
it("shows a real active-assignment conflict when deactivation is blocked", async () => {
  const fetcher = setup(), user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "View Rider One details" }));
  fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ success: false, error: { code: "RIDER_HAS_ACTIVE_ASSIGNMENTS" } }), { status: 409 }));
  await user.click(await screen.findByRole("button", { name: "Deactivate Rider" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/active assignment/)).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Deactivate Rider" }));
  expect(await within(dialog).findByText(/still has active assignments/)).toBeTruthy();
});
it("reactivates an inactive Rider and makes the state distinguishable", async () => {
  const inactive = { ...rider, isActive: false, deactivatedAt: "2026-10-23T00:00:00.000Z", workload: "AVAILABLE", assignedTaskCount: 0, inProgressDeliveryCount: 0, activeAssignedTaskCount: 0 };
  const inactiveDashboard = { ...dashboard, list: { riders: [inactive], pagination }, overview: { totalRiders: 1, available: 0, assigned: 0, delivering: 0, inactive: 1 } };
  const fetcher = setup(inactiveDashboard, inactive), user = userEvent.setup();
  expect(await screen.findByText("Inactive Riders")).toBeTruthy();
  expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
  await user.click(await screen.findByRole("button", { name: "View Rider One details" }));
  await user.click(await screen.findByRole("button", { name: "Reactivate Rider" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Reactivate Rider" }));
  expect(await screen.findByText(/Rider reactivated/)).toBeTruthy();
  expect(fetcher.mock.calls.some(call => JSON.parse(call[1].body).action === "reactivate")).toBe(true);
});
