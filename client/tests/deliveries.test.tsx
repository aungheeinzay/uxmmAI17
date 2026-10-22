import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignmentList } from "@/features/deliveries/components/assignment-list";
import { OperatorAssignments } from "@/features/deliveries/components/operator-assignments";
import { RiderDeliveryDetails } from "@/features/deliveries/components/rider-delivery-details";
import { useDeliveryMutation } from "@/features/deliveries/hooks/use-deliveries";
import { assignParcel } from "@/features/deliveries/api/deliveries.api";
import { deliveryStatusSchema } from "@/features/deliveries/types/delivery.types";
import { useAuthStore } from "@/stores/auth.store";
import { parcel, parcelList, operatorUser } from "./fixtures/operator-orders";
import { assignment, assignments, emptyAssignmentCounts, riderUser } from "./fixtures/deliveries";
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const ok = (data: unknown) => reply({ success: true, data });
beforeEach(() => { useAuthStore.getState().setUser(riderUser); vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok(assignments))); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });
it("loads Rider-owned deliveries with detail links and real COD", async () => {
  render(<AssignmentList />);
  expect(await screen.findByText(assignment.order.orderCode)).toBeTruthy();
  expect(screen.getByText("COD: 25,000.50 MMK")).toBeTruthy();
  expect(screen.getByRole("link", { name: /View delivery/ }).getAttribute("href")).toBe(`/rider/assignments/${assignment.id}`);
  expect(fetch).toHaveBeenCalledWith("/api/session/rider/assignments", expect.objectContaining({ body: JSON.stringify({ page: 1, pageSize: 20 }), credentials: "same-origin" }));
});
it("assigns only after choosing a Rider and confirming, leaving status unchanged", async () => {
  useAuthStore.getState().setUser(operatorUser);
  let assigned = false;
  vi.mocked(fetch).mockImplementation(async input => {
    if (String(input).endsWith("/create")) { assigned = true; return ok(assignment); }
    if (String(input).endsWith("/riders")) return ok({ riders: [riderUser], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    return ok({ ...parcelList, orders: assigned ? [] : [{ ...parcel, status: "PICKED_UP" }] });
  });
  render(<OperatorAssignments />); const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Assign Rider" }));
  await screen.findByLabelText("Eligible Rider");
  await user.selectOptions(screen.getByLabelText("Eligible Rider"), riderUser.id);
  await user.click(screen.getByRole("button", { name: "Confirm assignment" }));
  expect(await screen.findByText(/Rider assigned to/)).toBeTruthy();
  await screen.findByText("No received parcels awaiting assignment.");
  const calls = vi.mocked(fetch).mock.calls;
  expect(calls.filter(call => String(call[0]).endsWith("/create"))).toHaveLength(1);
  expect(JSON.parse(calls.find(call => String(call[0]).endsWith("/orders"))![1]!.body as string)).toMatchObject({ status: "PICKED_UP", unassigned: "true" });
  expect(JSON.parse(calls.find(call => String(call[0]).endsWith("/create"))![1]!.body as string)).toEqual({ orderId: parcel.id, riderId: riderUser.id });
  expect(assignment.order.status).toBe("PICKED_UP");
});
it("cancel assignment sends no mutation", async () => {
  useAuthStore.getState().setUser(operatorUser);
  vi.mocked(fetch).mockImplementation(async input => ok(String(input).endsWith("/riders") ? { riders: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } : { ...parcelList, orders: [{ ...parcel, status: "PICKED_UP" }] }));
  render(<OperatorAssignments />); const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Assign Rider" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).endsWith("/create"))).toBe(false);
});
it("guards repeated submissions synchronously", async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useDeliveryMutation(assignParcel));
  let pending!: Promise<unknown>;
  act(() => { pending = result.current.submit({ orderId: parcel.id, riderId: riderUser.id }); void result.current.submit({ orderId: parcel.id, riderId: riderUser.id }); });
  expect(fetch).toHaveBeenCalledTimes(1); expect(result.current.isPending).toBe(true);
  await act(async () => { finish(ok(assignment)); await pending; });
  expect(result.current.isPending).toBe(false);
});
it("executes full Rider delivery sequence with confirmations and refreshed history", async () => {
  let current = structuredClone(assignment);
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (String(input).endsWith("/status")) {
      const body = JSON.parse(init!.body as string); const previousStatus = current.order.status;
      current = { ...current, order: { ...current.order, status: body.status, statusEvents: [...current.order.statusEvents, { id: "bb0e8400-e29b-41d4-a716-446655440000", previousStatus, status: body.status, note: body.note ?? null, createdAt: "2026-10-21T02:00:00.000Z", actor: riderUser }] } };
      return ok({ ...current, previousStatus });
    }
    return ok(current);
  });
  render(<RiderDeliveryDetails id={assignment.id} />); const user = userEvent.setup();
  for (const name of ["Start delivery", "Mark out for delivery", "Confirm delivered"]) {
    await user.click(await screen.findByRole("button", { name }));
    await user.click(screen.getByRole("button", { name: "Confirm status change" }));
  }
  expect(await screen.findByText("No delivery actions are available for this status.")).toBeTruthy();
  expect(current.order.status).toBe("DELIVERED"); expect(current.order.statusEvents).toHaveLength(3);
  expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith("/status"))).toHaveLength(3);
});
it("requires failure reason and sends trimmed note", async () => {
  const inTransit = { ...assignment, order: { ...assignment.order, status: "IN_TRANSIT" } };
  vi.mocked(fetch).mockImplementation(async () => ok(inTransit));
  render(<RiderDeliveryDetails id={assignment.id} />); const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Report failed delivery" }));
  await user.click(screen.getByRole("button", { name: "Confirm status change" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith("/status"))).toHaveLength(0);
  await user.type(screen.getByLabelText("Failure reason"), "  Recipient unavailable  ");
  vi.mocked(fetch).mockImplementation(async () => ok({ ...inTransit, previousStatus: "IN_TRANSIT", order: { ...inTransit.order, status: "FAILED" } }));
  await user.click(screen.getByRole("button", { name: "Confirm status change" }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(call => String(call[0]).endsWith("/status"))).toBe(true));
  const request = vi.mocked(fetch).mock.calls.find(call => String(call[0]).endsWith("/status"))!;
  expect(JSON.parse(request[1]!.body as string)).toEqual({ id: assignment.id, status: "FAILED", note: "Recipient unavailable" });
});
it.each(["DELIVERED", "FAILED", "CANCELLED", "CREATED"])("hides Rider actions for %s", async status => {
  vi.mocked(fetch).mockImplementation(async () => ok({ ...assignment, order: { ...assignment.order, status } }));
  render(<RiderDeliveryDetails id={assignment.id} />);
  await screen.findByText("No delivery actions are available for this status.");
  expect(screen.queryByRole("button", { name: "Start delivery" })).toBeNull();
});
it("shows assignment monitoring with current status, Rider and history navigation", async () => {
  useAuthStore.getState().setUser(operatorUser); render(<AssignmentList operator />);
  await screen.findByText("Rider: Test Rider");
  expect(screen.getByText("Picked up")).toBeTruthy();
  expect(screen.getByRole("link", { name: /View delivery details/ }).getAttribute("href")).toContain(`/operator/parcels/${parcel.id}`);
});
it.each([[403, "permission"], [404, "not found"], [500, "unavailable"], [503, "unavailable"]])("renders safe %s feedback without clearing a valid session", async (status, message) => {
  vi.mocked(fetch).mockImplementation(async () => reply({ error: { code: "SECRET" } }, status as number));
  render(<AssignmentList />);
  expect((await screen.findByRole("alert")).textContent).toContain(message);
  expect(useAuthStore.getState().user).toEqual(riderUser);
});
it("refreshes on 409 and preserves feedback", async () => {
  vi.mocked(fetch).mockImplementation(async input => String(input).endsWith("/status") ? reply({ error: { code: "CONFLICT" } }, 409) : ok(assignment));
  render(<RiderDeliveryDetails id={assignment.id} />); const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Start delivery" }));
  await user.click(screen.getByRole("button", { name: "Confirm status change" }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).endsWith("/detail")).length).toBeGreaterThan(1));
  expect((await screen.findByRole("alert")).textContent).toContain("status changed");
});
it("supports empty pages and validates failure payloads", async () => {
  vi.mocked(fetch).mockImplementation(async () => ok({ assignments: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, counts: emptyAssignmentCounts }));
  render(<AssignmentList />); await screen.findByText("No assigned deliveries found.");
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  expect(deliveryStatusSchema.safeParse({ status: "FAILED", note: "  " }).success).toBe(false);
});
