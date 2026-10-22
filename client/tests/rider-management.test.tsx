import { afterEach, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RiderManagement } from "@/features/riders/components/rider-management";
import { useAuthStore } from "@/stores/auth.store";
const id = "550e8400-e29b-41d4-a716-446655440000", providerId = "660e8400-e29b-41d4-a716-446655440000";
const rider = { id, fullName: "Rider One", email: "rider@example.test", phone: "09123456789", providerId, provider: { id: providerId, name: "Flash Deliver" }, accountStatus: "ACTIVATED", workload: "DELIVERING", assignedTaskCount: 1, inProgressDeliveryCount: 2, activeAssignedTaskCount: 3, completedDeliveryCount: 4 };
const pagination = { page: 1, pageSize: 20, total: 1, totalPages: 1 };
const dashboard = { list: { riders: [rider], pagination }, overview: { totalRiders: 1, available: 0, assigned: 0, delivering: 1 }, pending: { invitations: [], pagination: { ...pagination, total: 0, totalPages: 0 } } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });
function setup(data: unknown = dashboard) {
  useAuthStore.getState().setUser({ id, role: "OPERATOR", fullName: "Operator", phone: null });
  const fetcher = vi.fn().mockImplementation(async (_url, options) => {
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify({ success: true, data: body.action === "detail" ? { rider, assignments: [], pagination: { ...pagination, total: 0, totalPages: 0 } } : data }), { status: 200 });
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
it("opens provider-scoped Rider detail with delivered summary and assignments empty state", async () => {
  const fetcher = setup(), user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "View Rider One details" }));
  expect(await screen.findByText("Provider: Flash Deliver")).toBeTruthy(); expect(screen.getByText(/4 delivered/)).toBeTruthy(); expect(screen.getByText("No assigned parcels.")).toBeTruthy();
  expect(fetcher.mock.calls.some(call => JSON.parse(call[1].body).id === id)).toBe(true);
  await user.click(screen.getByRole("button", { name: "Close details" })); expect(screen.queryByRole("region", { name: "Rider details" })).toBeNull();
});
it("shows separate pending invitees and empty Riders without counting them as active Riders", async () => {
  setup({ ...dashboard, list: { riders: [], pagination: { ...pagination, total: 0, totalPages: 0 } }, overview: { totalRiders: 0, available: 0, assigned: 0, delivering: 0 }, pending: { invitations: [{ id, email: "pending@example.test", fullName: "Pending Rider", createdAt: "2026-10-22T00:00:00Z", expiresAt: "2026-10-23T00:00:00Z" }], pagination } });
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
