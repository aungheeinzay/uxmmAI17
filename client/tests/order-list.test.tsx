import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderList } from "@/features/orders/components/order-list";

const orderUuid = "550e8400-e29b-41d4-a716-446655440001";
const orderUuidTwo = "550e8400-e29b-41d4-a716-446655440002";
const operatorUuid = "550e8400-e29b-41d4-a716-446655440099";

function order(id: string, code: string, recipient: string, status: string, township: string) {
  return {
    id,
    orderCode: code,
    destinationCity: "yangon",
    deliveryProviderId: operatorUuid,
    deliveryProvider: { id: operatorUuid, name: "Shwe Express" },
    deliveryFee: "3500.00",
    recipientName: recipient,
    phoneNumber: "09123456789",
    township,
    deliveryAddress: "No. 12 Main Road",
    parcelWeight: "2.5",
    parcelWeightUnit: "kg",
    codAmount: "15000",
    currency: "MMK",
    senderName: "Example Shop",
    status,
    createdAt: "2026-10-20T08:30:00.000Z",
    operatorId: operatorUuid,
    operator: { id: operatorUuid, fullName: "Operator One" },
  };
}

const payload = {
  success: true,
  data: {
    orders: [
      order(orderUuid, "POAABBCCDDEEFF0011", "Aye Chan", "CREATED", "Hlaing"),
      order(orderUuidTwo, "POAABBCCDDEEFF0022", "Nyi Nyi", "FAILED", "Thanlyin"),
    ],
    pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
    tabCounts: { all: 24, needsPickup: 5, exceptions: 3 },
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("All parcels list", () => {
  it("renders the parcel table with tab counts and a create button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<OrderList />);

    expect(await screen.findByRole("heading", { name: "All parcels" })).toBeTruthy();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("POAABBCCDDEEFF0011")).toBeTruthy();
    expect(within(table).getByText("Aye Chan")).toBeTruthy();

    const tablist = screen.getByRole("tablist", { name: "Parcel views" });
    expect(within(tablist).getByRole("tab", { name: /All parcels/ }).textContent).toContain("24");
    expect(within(tablist).getByRole("tab", { name: /Needs pickup/ }).textContent).toContain("5");
    expect(within(tablist).getByRole("tab", { name: /Exceptions/ }).textContent).toContain("3");

    const createLink = screen.getByRole("link", { name: "Create parcel" });
    expect(createLink.getAttribute("href")).toBe("/seller/order/new");
  });

  it("requests the needs_pickup tab when selected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrderList />);

    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("tab", { name: /Needs pickup/ }));

    await waitFor(() => {
      const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(calledUrl).toContain("tab=needs_pickup");
    });
  });

  it("filters the list by status through the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrderList />);

    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Filter parcels by status"), "IN_TRANSIT");

    await waitFor(() => {
      const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(calledUrl).toContain("status=IN_TRANSIT");
    });
  });

  it("clears the status filter when a saved view is chosen", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrderList />);

    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Filter parcels by status"), "FAILED");
    await waitFor(() => {
      expect(fetchMock.mock.calls.at(-1)?.[0] as string).toContain("status=FAILED");
    });

    await userEvent.click(screen.getByRole("tab", { name: /Exceptions/ }));

    await waitFor(() => {
      const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(calledUrl).toContain("tab=exceptions");
      expect(calledUrl).not.toContain("status=");
    });
    expect((screen.getByLabelText("Filter parcels by status") as HTMLSelectElement).value).toBe("");
  });

  it("returns to the first page when the status filter changes", async () => {
    const pagedPayload = {
      ...payload,
      data: { ...payload.data, pagination: { page: 1, pageSize: 10, total: 24, totalPages: 3 } },
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(pagedPayload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<OrderList />);

    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.at(-1)?.[0] as string).toContain("page=2");
    });

    await userEvent.selectOptions(screen.getByLabelText("Filter parcels by status"), "DELIVERED");

    await waitFor(() => {
      const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(calledUrl).toContain("status=DELIVERED");
      expect(calledUrl).toContain("page=1");
    });
  });

  it("shows the pagination summary", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    render(<OrderList />);

    expect(await screen.findByText("Showing 1–2 of 2")).toBeTruthy();
  });

  it("shows an error state when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    render(<OrderList />);

    expect(await screen.findByText("Parcels unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
