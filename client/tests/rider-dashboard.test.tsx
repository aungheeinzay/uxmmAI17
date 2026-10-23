import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RiderDashboard } from "@/features/deliveries/components/rider-dashboard";
import { useAuthStore } from "@/stores/auth.store";
import type { RiderAssignmentList } from "@/features/deliveries/types/delivery.types";
import { assignment, emptyAssignmentCounts, riderUser } from "./fixtures/deliveries";

type Delivery = RiderAssignmentList["assignments"][number];

const counts = {
  active: { all: 3, PICKED_UP: 1, IN_TRANSIT: 1, OUT_FOR_DELIVERY: 1 },
  completed: { all: 3, DELIVERED: 1, FAILED: 1, CANCELLED: 1 },
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const ok = (data: unknown) => reply({ success: true, data });

function delivery(index: number, status: string, recipient: string, destination: string | null = "Yangon"): Delivery {
  const item = structuredClone(assignment) as Delivery;
  item.id = `aa0e8400-e29b-41d4-a716-44665544${String(index).padStart(4, "0")}`;
  item.order = {
    ...item.order,
    id: item.orderId,
    orderCode: `PODEAD${String(index).padStart(12, "0")}`,
    recipientName: recipient,
    destinationCity: destination,
    status,
  };
  return item;
}

function listResponse(items: Delivery[], options: {
  page?: number;
  total?: number;
  totalPages?: number;
  counts?: typeof counts;
} = {}) {
  const page = options.page ?? 1;
  return ok({
    assignments: items,
    pagination: { page, pageSize: 20, total: options.total ?? items.length, totalPages: options.totalPages ?? 1 },
    counts: options.counts ?? counts,
  });
}

function lastRequest() {
  const calls = vi.mocked(fetch).mock.calls;
  return JSON.parse(calls.at(-1)![1]!.body as string);
}

beforeEach(() => {
  useAuthStore.getState().setUser(riderUser);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  useAuthStore.setState({ user: null, status: "loading", revision: 0 });
});

it("shows a real loading state and disables refresh while the server request is pending", async () => {
  vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
  render(<RiderDashboard />);
  expect((await screen.findByRole("status")).textContent).toContain("Loading your deliveries");
  expect((screen.getByRole("button", { name: "Refresh deliveries" }) as HTMLButtonElement).disabled).toBe(true);
});

it("requests active and completed server groups with full-dataset chip counts", async () => {
  const active = [
    delivery(1, "PICKED_UP", "Picked Up Recipient"),
    delivery(2, "IN_TRANSIT", "Transit Recipient"),
    delivery(3, "OUT_FOR_DELIVERY", "Out Recipient"),
  ];
  const completed = [
    delivery(4, "DELIVERED", "Delivered Recipient"),
    delivery(5, "FAILED", "Failed Recipient"),
    delivery(6, "CANCELLED", "Cancelled Recipient"),
  ];
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    const body = JSON.parse(init!.body as string) as { group: string; status?: string; page: number };
    const source = body.group === "completed" ? completed : active;
    const items = body.status ? source.filter(item => item.order.status === body.status) : source;
    return listResponse(items, { total: source.length, counts });
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("Picked Up Recipient")).toBeTruthy();
  expect(lastRequest()).toEqual({ page: 1, pageSize: 20, group: "active" });
  expect(screen.getByRole("tab", { name: "My Deliveries, 3 deliveries" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Completed, 3 deliveries" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "All, 3 deliveries" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Picked Up, 1 delivery" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "In Transit, 1 delivery" }));
  expect(await screen.findByText("Transit Recipient")).toBeTruthy();
  expect(screen.queryByText("Picked Up Recipient")).toBeNull();
  expect(lastRequest()).toEqual({ page: 1, pageSize: 20, group: "active", status: "IN_TRANSIT" });
  expect(screen.getByRole("button", { name: "All, 3 deliveries" })).toBeTruthy();

  await user.click(screen.getByRole("tab", { name: /Completed/ }));
  expect(await screen.findByText("Delivered Recipient")).toBeTruthy();
  expect(lastRequest()).toEqual({ page: 1, pageSize: 20, group: "completed" });
  expect(screen.queryByRole("group", { name: "Active delivery filters" })).toBeNull();
  expect(screen.getByRole("tab", { name: /Completed/ }).getAttribute("aria-selected")).toBe("true");
});

it("supports arrow-key tab navigation with roving focus", async () => {
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    const body = JSON.parse(init!.body as string) as { group: string };
    return listResponse(body.group === "completed" ? [] : [delivery(1, "PICKED_UP", "Keyboard Recipient")], { counts });
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("Keyboard Recipient")).toBeTruthy();
  const activeTab = screen.getByRole("tab", { name: /My Deliveries/ });
  activeTab.focus();
  await user.keyboard("{ArrowRight}");
  const completedTab = screen.getByRole("tab", { name: /Completed/ });
  expect(completedTab.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(completedTab);
  expect(activeTab.getAttribute("tabindex")).toBe("-1");
  await user.keyboard("{Home}");
  expect(screen.getByRole("tab", { name: /My Deliveries/ }).getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(activeTab);
});

it("labels terminal deliveries without turning them back into active work", async () => {
  const completed = [
    delivery(4, "DELIVERED", "Delivered Recipient"),
    delivery(5, "FAILED", "Failed Recipient", null),
    delivery(6, "CANCELLED", "Cancelled Recipient"),
  ];
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    const body = JSON.parse(init!.body as string) as { group: string };
    return listResponse(body.group === "completed" ? completed : []);
  });
  render(<RiderDashboard />);
  await screen.findByText("No active deliveries right now");
  await userEvent.setup().click(screen.getByRole("tab", { name: /Completed/ }));
  expect(await screen.findByText("Delivery completed")).toBeTruthy();
  expect(screen.getByText("Delivery failed")).toBeTruthy();
  expect(screen.getByText("Delivery cancelled")).toBeTruthy();
  expect(screen.getByText("To Tamwe")).toBeTruthy();
  expect(screen.getAllByText("1.250 kg").length).toBeGreaterThan(0);
  expect(screen.queryByText("Delivery in progress")).toBeNull();
});

it("shows distinct empty states for no assignments, an empty filter and no completed work", async () => {
  const filterCounts = {
    active: { all: 3, PICKED_UP: 2, IN_TRANSIT: 0, OUT_FOR_DELIVERY: 1 },
    completed: counts.completed,
  };
  let current: "none" | "filter" | "completed" = "none";
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    const body = JSON.parse(init!.body as string) as { group: string; status?: string };
    if (body.group === "completed") {
      current = "completed";
      return listResponse([], { counts: emptyAssignmentCounts });
    }
    if (body.status) {
      current = "filter";
      return listResponse([], { counts: filterCounts });
    }
    current = "none";
    return listResponse([], { counts: filterCounts });
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("No active deliveries right now")).toBeTruthy();
  expect(current).toBe("none");

  await user.click(screen.getByRole("button", { name: "In Transit, 0 deliveries" }));
  expect(await screen.findByText("No In Transit deliveries right now")).toBeTruthy();
  expect(screen.getByText("Choose another filter to see your other active deliveries.")).toBeTruthy();
  expect(current).toBe("filter");

  await user.click(screen.getByRole("tab", { name: /Completed/ }));
  expect(await screen.findByText("No completed deliveries yet")).toBeTruthy();
  expect(screen.getByText("Delivered, failed and cancelled parcels appear here.")).toBeTruthy();
  expect(current).toBe("completed");
});

it("paginates the server result and keeps counts independent of the current page", async () => {
  const first = delivery(1, "PICKED_UP", "First Page Recipient");
  const second = delivery(2, "IN_TRANSIT", "Second Page Recipient");
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    const body = JSON.parse(init!.body as string) as { page: number };
    return listResponse(body.page === 2 ? [second] : [first], { page: body.page, total: 3, totalPages: 2, counts });
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("First Page Recipient")).toBeTruthy();
  expect(screen.getByRole("button", { name: "All, 3 deliveries" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Second Page Recipient")).toBeTruthy();
  expect(lastRequest()).toEqual({ page: 2, pageSize: 20, group: "active" });
  expect(screen.getByRole("button", { name: "All, 3 deliveries" })).toBeTruthy();
});

it("renders a retryable error and recovers without clearing the Rider session", async () => {
  let attempts = 0;
  vi.mocked(fetch).mockImplementation(async () => {
    attempts += 1;
    if (attempts === 1) return reply({ success: false, error: { code: "SERVICE_UNAVAILABLE" } }, 503);
    return listResponse([delivery(1, "PICKED_UP", "Recovered Recipient")]);
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect((await screen.findByRole("alert")).textContent).toContain("delivery service is unavailable");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Recovered Recipient")).toBeTruthy();
  expect(useAuthStore.getState().user).toEqual(riderUser);
  expect(attempts).toBe(2);
});

it("refreshes after a delivery mutation event and through the explicit refresh control", async () => {
  let requests = 0;
  vi.mocked(fetch).mockImplementation(async () => {
    requests += 1;
    return listResponse([delivery(1, "PICKED_UP", `Refresh Recipient ${requests}`)]);
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("Refresh Recipient 1")).toBeTruthy();
  await act(async () => { window.dispatchEvent(new Event("deliveries-changed")); });
  expect(await screen.findByText("Refresh Recipient 2")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Refresh deliveries" }));
  expect(await screen.findByText("Refresh Recipient 3")).toBeTruthy();
});

it("returns to page one after a mutation so a shrinking dataset cannot leave an empty page", async () => {
  const first = delivery(1, "PICKED_UP", "First Page Recipient");
  const second = delivery(2, "IN_TRANSIT", "Second Page Recipient");
  const afterMutation = delivery(3, "OUT_FOR_DELIVERY", "After Mutation Recipient");
  let requests = 0;
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    requests += 1;
    const body = JSON.parse(init!.body as string) as { page: number };
    const items = body.page === 2 ? [second] : [requests > 2 ? afterMutation : first];
    return listResponse(items, { page: body.page, total: 3, totalPages: 2, counts });
  });
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("First Page Recipient")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Second Page Recipient")).toBeTruthy();
  expect(lastRequest()).toEqual({ page: 2, pageSize: 20, group: "active" });
  await act(async () => { window.dispatchEvent(new Event("deliveries-changed")); });
  expect(await screen.findByText("After Mutation Recipient")).toBeTruthy();
  expect(lastRequest()).toEqual({ page: 1, pageSize: 20, group: "active" });
});

it("links cards to owned assignments, exposes incidents, and keeps QR scanning honest", async () => {
  const item = delivery(1, "PICKED_UP", "Navigation Recipient");
  vi.mocked(fetch).mockImplementation(async () => listResponse([item]));
  render(<RiderDashboard />);
  const user = userEvent.setup();
  expect(await screen.findByText("Navigation Recipient")).toBeTruthy();
  expect(screen.getByRole("link", { name: `View delivery ${item.order.orderCode}` }).getAttribute("href")).toBe(`/rider/assignments/${item.id}`);
  expect(screen.getByRole("link", { name: "Incidents" }).getAttribute("href")).toBe("/rider/incidents");
  await user.click(screen.getByRole("button", { name: /Scan Parcel QR Code/ }));
  expect(await screen.findByRole("heading", { name: "Scan Parcel QR Code" })).toBeTruthy();
  expect(screen.getByLabelText("Manual parcel code fallback")).toBeTruthy();
  expect(screen.queryByText("Verify custody")).toBeNull();
  expect(screen.getByRole("button", { name: "Back to deliveries" })).toBeTruthy();
});

it("contains horizontal overflow to the active chip row on mobile", async () => {
  vi.mocked(fetch).mockImplementation(async () => listResponse([delivery(1, "PICKED_UP", "Overflow Recipient")]));
  render(<RiderDashboard />);
  expect(await screen.findByText("Overflow Recipient")).toBeTruthy();
  const filterGroup = screen.getByRole("group", { name: "Active delivery filters" });
  expect(filterGroup.className).toContain("overflow-x-auto");
  expect(filterGroup.querySelector(".min-w-max")).toBeTruthy();
  expect(screen.getByRole("tabpanel").className).not.toContain("overflow-x-auto");
  expect(screen.getByRole("link", { name: /View delivery/ }).className).not.toContain("overflow-x-auto");
  expect(screen.getByRole("tab", { name: /My Deliveries/ }).getAttribute("aria-controls")).toBe("deliveries-panel");
});

it("does not render CREATED or terminal statuses inside the active tab even if a response includes them", async () => {
  const active = delivery(1, "PICKED_UP", "Visible Active Recipient");
  const created = delivery(2, "CREATED", "Hidden Created Recipient");
  const delivered = delivery(3, "DELIVERED", "Hidden Delivered Recipient");
  vi.mocked(fetch).mockImplementation(async () => listResponse([active, created, delivered]));
  render(<RiderDashboard />);
  expect(await screen.findByText("Visible Active Recipient")).toBeTruthy();
  expect(screen.queryByText("Hidden Created Recipient")).toBeNull();
  expect(screen.queryByText("Hidden Delivered Recipient")).toBeNull();
  expect(screen.getByRole("button", { name: "All, 3 deliveries" })).toBeTruthy();
});
