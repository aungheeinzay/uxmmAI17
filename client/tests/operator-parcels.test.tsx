import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncomingParcels } from "@/features/operator/components/incoming-parcels";
import { ParcelDetails } from "@/features/operator/components/parcel-details";
import { OperatorRecentParcels } from "@/features/operator/components/operator-recent-parcels";
import { ParcelStatusBadge } from "@/features/operator/components/parcel-status-badge";
import { useOperatorOrders } from "@/features/operator/hooks/use-operator-orders";
import { getOperatorOrders } from "@/features/operator/api/operator-orders.api";
import { formatParcelDecimal, formatParcelDate } from "@/features/operator/format";
import { operatorOrdersQuerySchema } from "@/features/operator/types/operator-order.types";
import { RoleGuard } from "@/features/auth/components/role-guard";
import { OperatorLayout } from "@/features/operator/components/operator-layout";
import { useAuthStore } from "@/stores/auth.store";
import { operatorUser, parcel, parcelList } from "./fixtures/operator-orders";
const navigation = vi.hoisted(() => ({ search: "", path: "/operator/parcels", push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }), usePathname: () => navigation.path }));
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => {
  navigation.search = "";
  navigation.path = "/operator/parcels";
  useAuthStore.getState().setUser(operatorUser);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ success: true, data: parcelList })));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });

it("loads real session API data, formats decimals, and links to UUID detail preserving filters", async () => {
  navigation.search = "status=CREATED&page=1&pageSize=20";
  render(<IncomingParcels />);
  expect(screen.getByRole("status").textContent).toContain("Loading");
  expect(await screen.findByText(parcel.orderCode)).toBeTruthy();
  expect(screen.getByText("25,000.50 MMK")).toBeTruthy();
  expect(screen.getByText("Test Seller")).toBeTruthy();
  expect(screen.getByText("Assigned Operator")).toBeTruthy();
  expect(screen.getByText("21 Oct 2026, 06:30")).toBeTruthy();
  expect(screen.getByRole("link", { name: `View details for ${parcel.orderCode}` }).getAttribute("href")).toContain(`/operator/parcels/${parcel.id}?returnTo=`);
  expect(fetch).toHaveBeenCalledWith("/api/session/operator/orders", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ page: 1, pageSize: 20, status: "CREATED" });
});
it("submits only supported filters, resets the page, and uses server pagination", async () => {
  navigation.search = "page=2&pageSize=20";
  render(<IncomingParcels />); await screen.findByText(parcel.orderCode);
  const keyboard = userEvent.setup();
  await keyboard.type(screen.getByLabelText("Search parcels"), "Recipient");
  await keyboard.selectOptions(screen.getByLabelText("Status"), "CREATED");
  await keyboard.type(screen.getByLabelText("Township"), "Tamwe");
  await keyboard.click(screen.getByRole("button", { name: "Apply filters" }));
  const target = navigation.push.mock.calls.at(-1)![0];
  const params = new URL(target, "http://localhost").searchParams;
  expect(Object.fromEntries(params)).toEqual({ page: "1", pageSize: "20", search: "Recipient", status: "CREATED", township: "Tamwe" });
  await keyboard.click(screen.getByRole("button", { name: "Next" }));
  expect(navigation.push.mock.calls.at(-1)![0]).toContain("page=3");
  await keyboard.selectOptions(screen.getByLabelText("Rows per page"), "50");
  expect(navigation.push.mock.calls.at(-1)![0]).toBe("/operator/parcels?page=1&pageSize=50");
  await keyboard.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(navigation.push.mock.calls.at(-1)![0]).toBe("/operator/parcels?page=1&pageSize=20");
});
it("reissues backend requests when URL page or filters change", async () => {
  const view = render(<IncomingParcels />); await screen.findByText(parcel.orderCode);
  navigation.search = "page=2&pageSize=10&createdDate=2026-10-21";
  view.rerender(<IncomingParcels />);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)).toEqual({ page: 2, pageSize: 10, createdDate: "2026-10-21" });
});
it("shows empty data without manufactured rows or totals", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: { orders: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } }));
  render(<IncomingParcels />);
  expect(await screen.findByText("No parcels found")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
});
it.each([[403, "permission"], [503, "connection"]])("shows safe %s feedback and allows retry", async (status, message) => {
  vi.mocked(fetch).mockResolvedValue(reply({ error: { code: "PRIVATE_ERROR" } }, status as number));
  render(<IncomingParcels />);
  expect((await screen.findByRole("alert")).textContent).toContain(message);
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: parcelList }));
  await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(parcel.orderCode)).toBeTruthy();
});
it("rejects invalid URL filters without a network request", () => {
  navigation.search = "status=PENDING"; render(<IncomingParcels />);
  expect(screen.getByRole("alert").textContent).toContain("invalid"); expect(fetch).not.toHaveBeenCalled();
});
it("shows complete details, optional fallbacks and returned history", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: parcel }));
  render(<ParcelDetails id={parcel.id} backHref="/operator/parcels?page=2" />);
  expect(await screen.findByText("Fictional test lane")).toBeTruthy();
  expect(screen.getByText("1.250 kg")).toBeTruthy(); expect(screen.getByText("25,000.50 MMK")).toBeTruthy();
  expect(screen.getByText("No instructions provided")).toBeTruthy(); expect(screen.getByText("Test history")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Back to Parcels/ }).getAttribute("href")).toBe("/operator/parcels?page=2");
  expect(fetch).toHaveBeenCalledWith("/api/session/operator/orders/detail", expect.objectContaining({ body: JSON.stringify({ id: parcel.id }) }));
});
it("shows missing details and empty history", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ error: { code: "ORDER_NOT_FOUND" } }, 404));
  const view = render(<ParcelDetails id={parcel.id} />);
  expect(await screen.findByText("Parcel not found.")).toBeTruthy();
  view.unmount(); vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: { ...parcel, statusEvents: [] } }));
  render(<ParcelDetails id={parcel.id} />);
  expect(await screen.findByText("No status changes recorded.")).toBeTruthy();
});
it("renders legacy parcels with no assigned Operator without requiring retired delivery services", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: { ...parcelList, orders: [{ ...parcel, operatorId: null, operator: null }] } }));
  render(<IncomingParcels />);
  expect(await screen.findByText("Not assigned")).toBeTruthy();
  expect(screen.getByText(parcel.orderCode)).toBeTruthy();
});
it("rejects malformed responses and unsafe query values", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: { orders: [], pagination: {} } }));
  await expect(getOperatorOrders({ page: 1, pageSize: 20 })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  for (const input of [{ page: 0 }, { pageSize: 101 }, { createdDate: "2026-02-30" }, { role: "OPERATOR" }]) expect(operatorOrdersQuerySchema.safeParse(input).success).toBe(false);
});
it("formats exact decimal values and uses a safe unknown status fallback", () => {
  expect(formatParcelDecimal("9999999999.99")).toBe("9,999,999,999.99");
  expect(formatParcelDecimal("0")).toBe("0"); expect(formatParcelDate("invalid")).toBe("Date unavailable");
  render(<ParcelStatusBadge status="toString" />); expect(screen.getByText("toString")).toBeTruthy();
});
it("dashboard reads the actual total and recent page rather than calculating operational counts", async () => {
  render(<OperatorRecentParcels />); expect(await screen.findByText("41")).toBeTruthy();
  expect(screen.getByText(parcel.orderCode)).toBeTruthy();
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ page: 1, pageSize: 5 });
});
it("ignores late parcel results after logout", async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useOperatorOrders({ page: 1, pageSize: 20 }));
  act(() => useAuthStore.getState().clearUser());
  await act(async () => finish(reply({ success: true, data: parcelList })));
  expect(result.current.data).toBeUndefined();
});
it.each([["SME", "/seller"], ["RIDER", "/rider"]] as const)("redirects %s away from parcels without rendering private data", async (role, path) => {
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: { user: { ...operatorUser, role } } }));
  render(<RoleGuard role="OPERATOR"><IncomingParcels /></RoleGuard>);
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(path));
  expect(screen.queryByText(parcel.orderCode)).toBeNull();
});
it("redirects unauthenticated parcel visitors to login", async () => {
  vi.mocked(fetch).mockResolvedValue(reply({ error: { code: "UNAUTHORIZED" } }, 401));
  render(<RoleGuard role="OPERATOR"><IncomingParcels /></RoleGuard>);
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
  expect(screen.queryByText(parcel.orderCode)).toBeNull();
});
it("renders parcels after the guard verifies an OPERATOR session", async () => {
  vi.mocked(fetch).mockImplementation(async input => reply({ success: true, data:
    String(input) === "/api/session/me" ? { user: operatorUser } : parcelList }));
  render(<RoleGuard role="OPERATOR"><IncomingParcels /></RoleGuard>);
  expect(await screen.findByText(parcel.orderCode)).toBeTruthy();
  expect(navigation.replace).not.toHaveBeenCalled();
});
it("keeps the Operator shell mounted and verifies once while switching child routes", async () => {
  navigation.path = "/operator";
  vi.mocked(fetch).mockResolvedValue(reply({ success: true, data: { user: operatorUser } }));
  const view = render(<RoleGuard role="OPERATOR"><OperatorLayout><p>Dashboard panel</p></OperatorLayout></RoleGuard>);
  await screen.findByText("Dashboard panel");
  const header = screen.getByRole("banner");
  await userEvent.setup().click(screen.getByRole("button", { name: "Collapse sidebar" }));
  navigation.path = "/operator/parcels";
  view.rerender(<RoleGuard role="OPERATOR"><OperatorLayout><p>Parcels panel</p></OperatorLayout></RoleGuard>);
  expect(screen.getByText("Parcels panel")).toBeTruthy();
  expect(screen.getByRole("banner")).toBe(header);
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
  expect(screen.queryByText("Checking your session...")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Incoming Parcels" }).getAttribute("aria-current")).toBe("page");
});
