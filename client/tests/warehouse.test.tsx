import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarehouseManagement } from "@/features/operator/components/warehouse-management";
import { OperatorAssignments } from "@/features/deliveries/components/operator-assignments";
import { ParcelDetails } from "@/features/operator/components/parcel-details";
import { useAuthStore } from "@/stores/auth.store";
import { parcel, operatorUser } from "./fixtures/operator-orders";
import { assignment, riderUser } from "./fixtures/deliveries";
const navigation = vi.hoisted(() => ({ search: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.search), useRouter: () => navigation }));
const overview = { scope: "ALL_TIME", unassigned: 11, assignedAwaitingDispatch: 12, receivedAwaitingDispatch: 23, dispatched: 7, completed: 41, exceptions: 3 };
const row = { ...parcel, status: "PICKED_UP", warehouseState: "UNASSIGNED", assignment: null };
const pagination = { page: 1, pageSize: 20, total: 21, totalPages: 2 };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
beforeEach(() => {
  navigation.search = ""; useAuthStore.getState().setUser(operatorUser);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async input => ok(String(input).endsWith("/overview") ? overview : { orders: [row], pagination })));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });
it("shows real overview values, all-time scope and inventory/tracking distinction", async () => {
  render(<WarehouseManagement />);
  await screen.findByText("11"); expect(screen.getByText("12")).toBeTruthy(); expect(screen.getByText("41")).toBeTruthy();
  expect(screen.getByText("Received awaiting dispatch: 23")).toBeTruthy();
  expect(screen.getByText(/Tracking groups do not prove physical warehouse location/)).toBeTruthy();
  expect(screen.getByText(/Overview is independent of table filters/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Assign Rider" }).getAttribute("href")).toContain(`/operator/assignments?orderId=${parcel.id}&returnTo=`);
  expect(screen.getByRole("link", { name: `View details for ${parcel.orderCode}` }).getAttribute("href")).toContain(encodeURIComponent("/operator/warehouse?"));
});
it("applies state/search/township/date URL filters, resets page and supports server pagination", async () => {
  navigation.search = "page=2&pageSize=20";
  render(<WarehouseManagement />); await screen.findByText(parcel.orderCode); const user = userEvent.setup();
  await user.type(screen.getByLabelText("Search parcels"), "Test");
  await user.selectOptions(screen.getByLabelText("Warehouse state"), "DISPATCHED");
  await user.type(screen.getByLabelText("Township"), "Tamwe");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));
  const params = new URL(navigation.push.mock.calls.at(-1)![0], "http://localhost").searchParams;
  expect(Object.fromEntries(params)).toMatchObject({ page: "1", pageSize: "20", search: "Test", township: "Tamwe", warehouseState: "DISPATCHED" });
  await user.click(screen.getByRole("button", { name: "Previous" }));
  expect(navigation.push.mock.calls.at(-1)![0]).toContain("page=1");
  await user.selectOptions(screen.getByLabelText("Rows per page"), "50");
  expect(navigation.push.mock.calls.at(-1)![0]).toBe("/operator/warehouse?page=1&pageSize=50");
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(navigation.push.mock.calls.at(-1)![0]).toBe("/operator/warehouse?page=1&pageSize=20");
});
it("changes request parameters when URL state changes without reloading overview", async () => {
  const view = render(<WarehouseManagement />); await screen.findByText(parcel.orderCode);
  navigation.search = "page=2&pageSize=10&warehouseState=EXCEPTION&createdDate=2026-10-22";
  view.rerender(<WarehouseManagement />);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  const request = vi.mocked(fetch).mock.calls.at(-1)!;
  expect(JSON.parse(request[1]!.body as string)).toEqual({ page: 2, pageSize: 10, warehouseState: "EXCEPTION", createdDate: "2026-10-22" });
});
it.each([["ASSIGNED", "View Assignment"], ["DISPATCHED", "View Delivery Status"], ["COMPLETED", "View Details"], ["EXCEPTION", "View Failure"]])("shows %s context action and assigned Rider", async (warehouseState, label) => {
  const status = warehouseState === "DISPATCHED" ? "IN_TRANSIT" : warehouseState === "COMPLETED" ? "DELIVERED" : warehouseState === "EXCEPTION" ? "FAILED" : "PICKED_UP";
  vi.mocked(fetch).mockImplementation(async input => ok(String(input).endsWith("/overview") ? overview : { orders: [{ ...row, warehouseState, status, assignment: { ...assignment, rider: riderUser } }], pagination }));
  render(<WarehouseManagement />); const link = await screen.findByRole("link", { name: `View details for ${parcel.orderCode}` });
  expect(link.textContent).toBe(label); expect(await screen.findByText("Test Rider")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Assign Rider" })).toBeNull();
});
it.each([false, true])("renders valid empty state, filtered=%s", async filtered => {
  if (filtered) navigation.search = "warehouseState=UNASSIGNED";
  vi.mocked(fetch).mockImplementation(async input => ok(String(input).endsWith("/overview") ? overview : { orders: [], pagination: { ...pagination, total: 0, totalPages: 0 } }));
  render(<WarehouseManagement />); await screen.findByText(filtered ? "No parcels match these filters" : "No warehouse parcels found");
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
});
it.each([[403, "permission"], [500, "unavailable"], [503, "unavailable"]])("shows safe %s errors with retry and preserves valid sessions", async (status, message) => {
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith("/overview") ? ok(overview) : new Response(JSON.stringify({ error: { code: "PRIVATE_STACK" } }), { status: status as number }));
  render(<WarehouseManagement />); expect((await screen.findByRole("alert")).textContent).toContain(message);
  expect(useAuthStore.getState().user).toEqual(operatorUser);
  vi.mocked(fetch).mockImplementation(async () => ok({ orders: [row], pagination }));
  await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText(parcel.orderCode);
});
it("rejects invalid warehouse URLs before requesting data", () => {
  navigation.search = "warehouseState=CREATED"; render(<WarehouseManagement />);
  expect(screen.getByRole("alert").textContent).toContain("invalid"); expect(fetch).not.toHaveBeenCalled();
});
it("refetches counts and parcels after receipt/assignment events, window focus and manual refresh", async () => {
  render(<WarehouseManagement />); await screen.findByText(parcel.orderCode); expect(fetch).toHaveBeenCalledTimes(2);
  act(() => window.dispatchEvent(new Event("operator-parcels-changed")));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4)); await screen.findByText(parcel.orderCode);
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(6)); await screen.findByText(parcel.orderCode);
  await userEvent.setup().click(screen.getByRole("button", { name: "Refresh warehouse" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(8));
});
it("preserves selected parcel and back context in the existing assignment flow", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok({ ...parcel, status: "PICKED_UP", assignment: null }));
  render(<OperatorAssignments selectedOrderId={parcel.id} backHref="/operator/warehouse?warehouseState=UNASSIGNED&page=2" />);
  await screen.findByRole("button", { name: "Assign Rider" });
  expect(screen.getByText(parcel.orderCode)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to warehouse" }).getAttribute("href")).toContain("warehouseState=UNASSIGNED&page=2");
});
it("shows receipt history metadata and recorded failure on parcel detail", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok({ ...parcel, warehouseState: "EXCEPTION", status: "FAILED", receipt: { receivedAt: "2026-10-22T01:00:00.000Z", receivedBy: { id: operatorUser.id, fullName: "Receiving Operator" } }, failureNote: "Recipient unavailable" }));
  render(<ParcelDetails id={parcel.id} />);
  await screen.findByText("Receiving Operator"); expect(screen.getByText("Recipient unavailable")).toBeTruthy();
  expect(screen.getByText("Exception")).toBeTruthy();
});
