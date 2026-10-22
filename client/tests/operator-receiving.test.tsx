import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceiveParcelDialog } from "@/features/operator/components/receive-parcel-dialog";
import { ParcelDetails } from "@/features/operator/components/parcel-details";
import { IncomingParcels } from "@/features/operator/components/incoming-parcels";
import { useReceiveParcel } from "@/features/operator/hooks/use-receive-parcel";
import { useAuthStore } from "@/stores/auth.store";
import { operatorUser, parcel, parcelList } from "./fixtures/operator-orders";
const navigation = vi.hoisted(() => ({ search: "", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.search), useRouter: () => navigation }));
const received = { ...parcel, previousStatus: "CREATED", status: "PICKED_UP" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => {
  navigation.search = "";
  useAuthStore.getState().setUser(operatorUser);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => reply({ success: true, data: received })));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });

it("requires confirmation and cancel makes no request", async () => {
  render(<ReceiveParcelDialog order={parcel} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Confirm Received" }));
  expect(screen.getByRole("dialog").textContent).toContain(parcel.recipientName);
  expect(screen.getByRole("dialog").textContent).toContain(parcel.orderCode);
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(fetch).not.toHaveBeenCalled();
});
it.each(["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"])("does not receive %s through the UI", status => {
  render(<ReceiveParcelDialog order={{ ...parcel, status }} />);
  expect(screen.queryByRole("button")).toBeNull();
});
it("locks duplicate calls synchronously and returns the actual typed response", async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(useReceiveParcel);
  let pending!: Promise<unknown>;
  act(() => { pending = result.current.receive(parcel.id); void result.current.receive(parcel.id); });
  expect(result.current.isPending).toBe(true); expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => { finish(reply({ success: true, data: received })); await pending; });
  expect(result.current.data?.status).toBe("PICKED_UP"); expect(result.current.isPending).toBe(false);
  expect(fetch).toHaveBeenCalledWith("/api/session/operator/orders/receive", expect.objectContaining({ body: JSON.stringify({ id: parcel.id }), credentials: "same-origin" }));
});
it("disables confirmation while pending", async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<ReceiveParcelDialog order={parcel} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Confirm Received" }));
  await user.click(screen.getByRole("button", { name: "Confirm receipt" }));
  expect((screen.getByRole("button", { name: "Receiving…" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => finish(reply({ success: true, data: received })));
});
it.each([[401, "expired"], [403, "permission"], [404, "not found"], [409, "may have changed"], [429, "Too many"], [500, "unavailable"], [503, "unavailable"]])("handles %s safely", async (status, message) => {
  vi.mocked(fetch).mockImplementation(async () => reply({ error: { code: "SECRET_STACK_TRACE" } }, status as number));
  const refresh = vi.fn(); window.addEventListener("operator-parcels-changed", refresh);
  const { result } = renderHook(useReceiveParcel);
  await act(async () => { await result.current.receive(parcel.id); });
  expect(result.current.error).toContain(message); expect(result.current.error).not.toContain("SECRET");
  expect(useAuthStore.getState().user).toEqual(status === 401 ? null : operatorUser);
  expect(refresh).toHaveBeenCalledTimes(status === 409 ? 1 : 0);
  window.removeEventListener("operator-parcels-changed", refresh);
});
it("handles network errors without discarding the session", async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError("network"));
  const { result } = renderHook(useReceiveParcel);
  await act(async () => { await result.current.receive(parcel.id); });
  expect(result.current.error).toContain("connection"); expect(useAuthStore.getState().user).toEqual(operatorUser);
});
it.each([200, 409])("refreshes mounted details after receiving response %s", async status => {
  let changed = false;
  vi.mocked(fetch).mockImplementation(async input => {
    if (String(input).endsWith("/receive")) { changed = true; return status === 200 ? reply({ success: true, data: received }) : reply({ error: { code: "STATUS_UPDATE_CONFLICT" } }, 409); }
    return reply({ success: true, data: changed ? received : parcel });
  });
  render(<ParcelDetails id={parcel.id} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Confirm Received" }));
  await user.click(screen.getByRole("button", { name: "Confirm receipt" }));
  await screen.findByText("Picked up");
  expect(screen.queryByRole("button", { name: "Confirm Received" })).toBeNull();
  expect(screen.getByRole(status === 200 ? "status" : "alert").textContent).toContain(status === 200 ? "PICKED_UP" : "may have changed");
});
it("forces warehouse received-only filtering, shows address, and preserves navigation", async () => {
  navigation.search = "page=2&pageSize=10&status=CREATED&township=Tamwe&search=Test";
  vi.mocked(fetch).mockImplementation(async () => reply({ success: true, data: { ...parcelList, orders: [received] } }));
  render(<IncomingParcels warehouse />);
  await screen.findByText(parcel.deliveryAddress);
  expect(screen.getByRole("heading", { name: "Received Parcels" })).toBeTruthy();
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ page: 2, pageSize: 10, status: "PICKED_UP", township: "Tamwe", search: "Test" });
  expect(screen.queryByRole("button", { name: "Confirm Received" })).toBeNull();
  expect(screen.getByRole("link", { name: `View details for ${parcel.orderCode}` }).getAttribute("href")).toContain(encodeURIComponent("/operator/warehouse?"));
  await userEvent.setup().click(screen.getByRole("button", { name: "Next" }));
  expect(navigation.push.mock.calls.at(-1)?.[0]).toContain("/operator/warehouse?page=3");
  await waitFor(() => expect((screen.getByLabelText("Status") as HTMLSelectElement).disabled).toBe(true));
  await userEvent.setup().click(screen.getByRole("button", { name: "Apply filters" }));
  expect(navigation.push.mock.calls.at(-1)?.[0]).toContain("status=PICKED_UP");
});
