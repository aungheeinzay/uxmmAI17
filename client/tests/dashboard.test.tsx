import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmeDashboard } from "@/features/orders/components/sme-dashboard";

const uuid = "550e8400-e29b-41d4-a716-446655440000";
const orderUuid = "550e8400-e29b-41d4-a716-446655440001";
const orderUuidTwo = "550e8400-e29b-41d4-a716-446655440002";
const period = {
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-10-21T00:00:00.000Z",
  totalShipments: 12,
  totalDelivered: 9,
  successRate: 75,
};

function order(id: string, code: string, recipient: string, township: string, status: string) {
  return {
    id,
    orderCode: code,
    destinationCity: "yangon",
    deliveryProviderId: uuid,
    deliveryProvider: { id: uuid, name: "Shwe Express" },
    deliveryFee: "3500.00",
    recipient: { name: recipient, phoneNumber: "09123456789", township, deliveryAddress: "No. 12 Main Road" },
    parcel: { weight: "2.5", weightUnit: "kg", codAmount: "15000", currency: "MMK", deliveryInstructions: null },
    status,
    createdAt: "2026-10-20T08:30:00.000Z",
    trackingTimeline: [
      {
        status: "CREATED",
        previousStatus: null,
        note: null,
        createdAt: "2026-10-20T08:30:00.000Z",
        actor: { id: uuid, fullName: "Seller", role: "SME" },
      },
    ],
    qr: { identifier: "a".repeat(64), imageDataUrl: "data:image/png;base64,iVBORw0KGgo=" },
    operator: { id: uuid, fullName: "Operator One", phone: "0999888777" },
    deliveryRider: null,
  };
}

const payload = {
  success: true,
  data: {
    totalParcels: 24,
    statusCounts: {
      CREATED: 2,
      PICKED_UP: 3,
      IN_TRANSIT: 4,
      OUT_FOR_DELIVERY: 5,
      DELIVERED: 6,
      FAILED: 1,
      CANCELLED: 3,
    },
    deliveryOverview: { thisWeek: period, thisMonth: period },
    monthlyCosts: [
      { month: "2026-05", cost: "1260000", currency: "MMK", parcels: 4 },
      { month: "2026-06", cost: "1450000", currency: "MMK", parcels: 5 },
      { month: "2026-07", cost: "1360000", currency: "MMK", parcels: 3 },
      { month: "2026-08", cost: "1620000", currency: "MMK", parcels: 6 },
      { month: "2026-09", cost: "1840000", currency: "MMK", parcels: 8 },
      { month: "2026-10", cost: "1710000", currency: "MMK", parcels: 7 },
    ],
    recentOrders: [
      order(orderUuid, "ST-1001", "Aye Chan", "Hlaing", "DELIVERED"),
      order(orderUuidTwo, "ST-1002", "Nyi Nyi", "Thanlyin", "IN_TRANSIT"),
    ],
  },
};

const emptyMonthlyPayload = {
  success: true,
  data: {
    ...payload.data,
    monthlyCosts: payload.data.monthlyCosts.map((entry) => ({ ...entry, cost: "0", parcels: 0 })),
  },
};

const ordersPayload = {
  success: true,
  data: {
    orders: [
      {
        id: orderUuid,
        orderCode: "POAABBCCDDEEFF0011",
        destinationCity: "yangon",
        deliveryProviderId: uuid,
        deliveryProvider: { id: uuid, name: "Shwe Express" },
        deliveryFee: "3500.00",
        recipientName: "Aye Chan",
        phoneNumber: "09123456789",
        township: "Hlaing",
        deliveryAddress: "No. 12 Main Road",
        parcelWeight: "2.5",
        parcelWeightUnit: "kg",
        codAmount: "15000",
        currency: "MMK",
        senderName: "May Boutique",
        status: "IN_TRANSIT",
        createdAt: "2026-10-20T08:30:00.000Z",
        operatorId: uuid,
        operator: { id: uuid, fullName: "Operator One" },
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    tabCounts: { all: 1, needsPickup: 0, exceptions: 0 },
  },
};

function mockApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/orders") ? ordersPayload : payload;
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function openRecentShipments() {
  await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
  await userEvent.click(screen.getByRole("button", { name: "Recent shipments" }));
}

describe("SME dashboard", () => {
  it("renders the greeting header with the status metric grid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    expect(await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ })).toBeTruthy();
    expect(screen.getByText("Parcel operations")).toBeTruthy();
    expect(screen.getByText(/Here’s what’s happening with your deliveries today/)).toBeTruthy();

    const metrics = screen.getByRole("region", { name: "Parcel metrics" });
    expect(metrics.className).toContain("lg:grid-cols-6");
    expect(within(metrics).getByText("Total parcels")).toBeTruthy();
    expect(within(metrics).getByText("24")).toBeTruthy();
    expect(within(metrics).getByText("Pending pickup")).toBeTruthy();
    expect(within(metrics).getByText("At warehouse")).toBeTruthy();
    expect(within(metrics).getByText("In transit")).toBeTruthy();
    expect(within(metrics).getByText("Delivered")).toBeTruthy();
    expect(within(metrics).getByText("Failed / returned")).toBeTruthy();
  });

  it("groups failed and cancelled parcels in the failed metric", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
    const metrics = screen.getByRole("region", { name: "Parcel metrics" });
    const failedCard = within(metrics).getByText("Failed / returned").closest('[data-slot="card"]');
    expect(failedCard?.textContent).toContain("4");
  });

  it("switches between the parcel view and recent shipments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
    expect(screen.getByRole("button", { name: "Parcel view" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "Parcel metrics" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Recent parcels" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Recent shipments" }));

    expect(screen.queryByRole("region", { name: "Parcel metrics" })).toBeNull();
    expect(screen.queryByRole("button", { name: /View recent shipments/ })).toBeNull();
    expect(screen.queryByRole("table", { name: "Monthly delivery cost summary" })).toBeNull();
    expect(screen.getByRole("button", { name: "Recent shipments" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Parcel view" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("table", { name: "Recent parcels" })).toBeTruthy();
  });

  it("shows the recent shipments callout instead of the delivery overview", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
    expect(screen.queryByText("Delivery overview")).toBeNull();
    expect(screen.queryByText("This week")).toBeNull();

    const callout = screen.getByRole("heading", { name: "Recent shipments" });
    expect(callout.className).toContain("font-bold");
    expect(screen.getByText(/Open the latest parcel activity when you need a quick check/)).toBeTruthy();

    const action = screen.getByRole("button", { name: /View recent shipments/ });
    expect(action.className).toContain("rounded-full");
    expect(action.className).toContain("bg-brand-dark");
  });

  it("opens the recent shipments view from the callout action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
    await userEvent.click(screen.getByRole("button", { name: /View recent shipments/ }));

    expect(screen.getByRole("button", { name: "Recent shipments" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("region", { name: "Parcel metrics" })).toBeNull();
    expect(screen.getByRole("table", { name: "Recent parcels" })).toBeTruthy();
  });

  it("renders the monthly cost summary from the dashboard payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: "Monthly delivery cost summary" });

    expect(screen.getByText("Compare month-over-month delivery value, broken down by month.")).toBeTruthy();

    const previousCard = screen.getByText("Previous month").parentElement;
    expect(previousCard?.textContent).toContain("1,840,000 MMK");

    const currentCard = screen.getByText("This month").parentElement;
    expect(currentCard?.textContent).toContain("1,710,000 MMK");

    expect(screen.getByText("7.1% lower vs last month")).toBeTruthy();
    expect(screen.getByText("Monthly delivery cost summary")).toBeTruthy();
  });

  it("lists the monthly breakdown with month over month changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    const table = await screen.findByRole("table", { name: "Monthly delivery cost summary" });
    const rows = within(table).getAllByRole("row");

    expect(rows).toHaveLength(7);
    expect(rows[1].textContent).toContain("May 2026");
    expect(rows[1].textContent).toContain("1,260,000 MMK");
    expect(rows[1].textContent).toContain("—");
    expect(rows[2].textContent).toContain("Jun 2026");
    expect(rows[2].textContent).toContain("1,450,000 MMK");
    expect(rows[2].textContent).toContain("+15.1%");
    expect(rows[3].textContent).toContain("-6.2%");
    expect(rows[4].textContent).toContain("+19.1%");
    expect(rows[5].textContent).toContain("+13.6%");
    expect(rows[6].textContent).toContain("Oct 2026");
    expect(rows[6].textContent).toContain("-7.1%");
  });

  it("shows the period total and average under the monthly breakdown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("table", { name: "Monthly delivery cost summary" });

    expect(screen.getByText("6-month total").parentElement?.textContent).toContain("9,240,000 MMK");
    expect(screen.getByText("Monthly average").parentElement?.textContent).toContain("1,540,000 MMK");
  });

  it("shows an empty breakdown when no parcels were created", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(emptyMonthlyPayload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: "Monthly delivery cost summary" });

    expect(screen.queryByRole("table", { name: "Monthly delivery cost summary" })).toBeNull();
    expect(screen.getByText("No parcels created in these months yet, so every total is zero.")).toBeTruthy();
    expect(screen.getByText("This month").parentElement?.textContent).toContain("0 MMK");
  });

  it("places the monthly cost summary under the recent shipments callout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    const callout = await screen.findByRole("button", { name: /View recent shipments/ });
    const summary = screen.getByRole("heading", { name: "Monthly delivery cost summary" });

    expect(callout.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the full shipment list inside the dashboard tab", async () => {
    mockApi();
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
    const tab = screen.getByRole("button", { name: /All Shipments/ });
    expect(tab.getAttribute("aria-pressed")).toBe("false");
    expect(tab.textContent).toContain("24");

    await userEvent.click(tab);

    expect(screen.getByRole("heading", { name: "All shipments" })).toBeTruthy();
    expect(screen.getByText("POAABBCCDDEEFF0011")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Parcel metrics" })).toBeNull();
    expect(screen.getByRole("button", { name: /All Shipments/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows a loading skeleton while the All shipments request is pending", async () => {
    let resolveOrders!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes("/orders")) {
        return new Promise<Response>((resolve) => {
          resolveOrders = resolve;
        });
      }
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SmeDashboard />);

    await screen.findByRole("button", { name: /All Shipments/ });
    await userEvent.click(screen.getByRole("button", { name: /All Shipments/ }));

    expect(screen.getByRole("status", { name: "Loading parcels" })).toBeTruthy();
    expect(screen.queryByText("No parcels yet")).toBeNull();

    resolveOrders(new Response(JSON.stringify(ordersPayload), { status: 200 }));

    expect(await screen.findByText("POAABBCCDDEEFF0011")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading parcels" })).toBeNull();
  });

  it("filters the All shipments list by status through the API", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/orders") ? ordersPayload : payload;
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
    await userEvent.click(screen.getByRole("button", { name: /All Shipments/ }));
    await screen.findByText("POAABBCCDDEEFF0011");

    await userEvent.selectOptions(screen.getByLabelText("Filter parcels by status"), "DELIVERED");

    await waitFor(() => {
      const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(calledUrl).toContain("status=DELIVERED");
    });
  });

  it("links the create parcel action to the new parcel page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await screen.findByRole("heading", { name: /Welcome again, Shop Owner/ });
    const link = screen.getByRole("link", { name: /Create parcel/ });
    expect(link.getAttribute("href")).toBe("/seller/order/new");
  });

  it("uses status tone classes for order badges", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await openRecentShipments();
    const table = await screen.findByRole("table", { name: "Recent parcels" });
    const delivered = within(table).getByText("Delivered", { selector: "span" });
    expect(delivered.className).toContain("bg-success-soft");
    expect(delivered.className).toContain("text-success");
  });

  it("filters recent parcels by order code, recipient or township", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await openRecentShipments();
    await screen.findByText("ST-1001");
    const search = screen.getByLabelText("Search parcels by order code, recipient or township");
    await userEvent.type(search, "thanlyin");

    await waitFor(() => expect(screen.queryByText("ST-1001")).toBeNull());
    expect(screen.getByText("ST-1002")).toBeTruthy();
    expect(screen.getByText("1 of 2 shown")).toBeTruthy();
  });

  it("expands a parcel row to reveal tracking details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<SmeDashboard />);

    await openRecentShipments();
    await screen.findByText("ST-1001");
    await userEvent.click(screen.getByRole("button", { name: "Show details for ST-1001" }));

    expect(await screen.findByText("Tracking timeline")).toBeTruthy();
    expect(screen.getByText("Order information")).toBeTruthy();
  });
});
