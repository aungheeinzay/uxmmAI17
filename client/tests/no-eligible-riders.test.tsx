import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignParcelDialog } from "@/features/deliveries/components/assign-parcel-dialog";
import { DeliveryFeedback } from "@/features/deliveries/components/delivery-shared";
import { WarehouseManagement } from "@/features/operator/components/warehouse-management";
import { useAuthStore } from "@/stores/auth.store";
import { operatorUser, parcel } from "./fixtures/operator-orders";
import { assignment, riderUser } from "./fixtures/deliveries";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const pagination = { page: 1, pageSize: 20, total: 0, totalPages: 0 };
const empty = { riders: [], pagination };
const eligible = { riders: [riderUser], pagination: { ...pagination, total: 1, totalPages: 1 } };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
beforeEach(() => {
  useAuthStore.getState().setUser(operatorUser);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok(empty)));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });
async function open() { const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Assign Rider" })); return user; }
it("explains no eligible Riders, disables confirmation and offers refresh/management without assigning", async () => {
  render(<AssignParcelDialog order={parcel} />); await open();
  await screen.findByText("No riders available for assignment");
  expect(screen.getByText(/This parcel remains unassigned with status PICKED_UP/)).toBeTruthy();
  expect((screen.getByRole("button", { name: "Confirm assignment" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Refresh Riders" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Rider Management" }).getAttribute("href")).toBe("/operator/riders");
  expect(vi.mocked(fetch).mock.calls.every(call => String(call[0]).endsWith("/riders"))).toBe(true);
});
it("requires selection when eligible Riders exist and preserves parcel context", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok(eligible));
  render(<AssignParcelDialog order={parcel} />); const user = await open();
  await screen.findByLabelText("Eligible Rider");
  expect(screen.getByText("Please select a rider")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Please select a rider");
  expect(screen.getByRole("dialog").textContent).toContain(parcel.orderCode);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("loading disables confirmation and never displays a misleading empty state", async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<AssignParcelDialog order={parcel} />); await open();
  expect(screen.getByRole("status").textContent).toContain("Loading");
  expect(screen.queryByText("No riders available for assignment")).toBeNull();
  expect((screen.getByRole("button", { name: "Confirm assignment" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finish(ok(empty)));
  await screen.findByText("No riders available for assignment");
});
it("Rider API errors offer retry instead of an empty-state claim", async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE" } }), { status: 503 }));
  render(<AssignParcelDialog order={parcel} />); const user = await open();
  expect((await screen.findByRole("alert")).textContent).toContain("unavailable");
  expect(screen.queryByText("No riders available for assignment")).toBeNull();
  expect((screen.getByRole("button", { name: "Confirm assignment" }) as HTMLButtonElement).disabled).toBe(true);
  vi.mocked(fetch).mockImplementation(async () => ok(eligible));
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByLabelText("Eligible Rider");
});
it("refreshes an empty list and permits selection and one successful assignment later", async () => {
  let hasRiders = false;
  vi.mocked(fetch).mockImplementation(async input => ok(String(input).endsWith("/create") ? assignment : hasRiders ? eligible : empty));
  render(<><DeliveryFeedback /><AssignParcelDialog order={parcel} /></>); const user = await open();
  await screen.findByText("No riders available for assignment"); hasRiders = true;
  await user.click(screen.getByRole("button", { name: "Refresh Riders" }));
  await screen.findByLabelText("Eligible Rider");
  await user.selectOptions(screen.getByLabelText("Eligible Rider"), riderUser.id);
  await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await screen.findByText(/Rider assigned to/);
  const creates = vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith("/create"));
  expect(creates).toHaveLength(1);
  expect(JSON.parse(creates[0][1]!.body as string)).toEqual({ orderId: parcel.id, riderId: riderUser.id });
});
it("selected Rider becoming ineligible shows backend validation, refreshes Riders and keeps the parcel UNASSIGNED", async () => {
  let rejected = false;
  const overview = { scope: "ALL_TIME", unassigned: 1, assignedAwaitingDispatch: 0, receivedAwaitingDispatch: 1, dispatched: 0, completed: 0, exceptions: 0 };
  vi.mocked(fetch).mockImplementation(async input => {
    const path = String(input);
    if (path.endsWith("/create")) { rejected = true; return new Response(JSON.stringify({ error: { code: "RIDER_NOT_ELIGIBLE" } }), { status: 404 }); }
    if (path.endsWith("/riders")) return ok(rejected ? empty : eligible);
    if (path.endsWith("/overview")) return ok(overview);
    return ok({ orders: [{ ...parcel, status: "PICKED_UP", warehouseState: "UNASSIGNED", assignment: null }], pagination: { ...pagination, total: 1, totalPages: 1 } });
  });
  render(<><WarehouseManagement /><AssignParcelDialog order={parcel} /></>);
  await screen.findByText(parcel.orderCode); const user = await open();
  await screen.findByLabelText("Eligible Rider");
  await user.selectOptions(screen.getByLabelText("Eligible Rider"), riderUser.id);
  await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
  await screen.findByText("An activated Rider account was not found.");
  await screen.findByText("No riders available for assignment");
  expect((screen.getByRole("button", { name: "Confirm assignment" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  const table = within(screen.getByRole("region", { name: "Received parcels table" }));
  expect(table.getByText("Unassigned")).toBeTruthy(); expect(table.getByText("Picked up")).toBeTruthy();
  expect(screen.queryByText(/Rider assigned to/)).toBeNull();
  expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith("/riders"))).toHaveLength(2);
});
it("refresh clears a previous selection so it cannot be submitted against stale eligibility", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok(eligible));
  render(<AssignParcelDialog order={parcel} />); const user = await open();
  await screen.findByLabelText("Eligible Rider");
  await user.selectOptions(screen.getByLabelText("Eligible Rider"), riderUser.id);
  await user.click(screen.getByRole("button", { name: "Refresh Riders" }));
  await screen.findByLabelText("Eligible Rider");
  expect((screen.getByLabelText("Eligible Rider") as HTMLSelectElement).value).toBe("");
  await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
  expect(screen.getByRole("alert").textContent).toBe("Please select a rider");
  expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).endsWith("/create"))).toBe(false);
});
it("an empty page does not claim every Rider is unavailable when earlier pages contain Riders", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok({ riders: [], pagination: { page: 2, pageSize: 20, total: 20, totalPages: 1 } }));
  render(<AssignParcelDialog order={parcel} />); await open();
  await screen.findByText("No eligible riders on this page. Return to an earlier page or refresh Riders.");
  expect(screen.queryByText("No riders available for assignment")).toBeNull();
});
