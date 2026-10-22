import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParcelDetailsContent } from "@/features/parcels/components/parcel-details-content";
import { ParcelDetailsView } from "@/features/parcels/components/parcel-details-view";

const orderId = "3d0f2b7c-8a51-4c62-9f10-5b6c7d8e9f00";
const orderCode = "POAABBCCDDEEFF0011";

const detailPayload = {
  success: true,
  data: {
    id: orderId,
    orderCode,
    ownerId: "550e8400-e29b-41d4-a716-446655440001",
    operatorId: "550e8400-e29b-41d4-a716-446655440099",
    destinationCity: "yangon",
    deliveryProviderId: "550e8400-e29b-41d4-a716-446655440098",
    deliveryProvider: { id: "550e8400-e29b-41d4-a716-446655440098", name: "Shwe Express" },
    deliveryFee: "3500.00",
    recipientName: "Aye Chan Myae Moe",
    phoneNumber: "092388",
    township: "Bahan",
    deliveryAddress: "Tower A Pin Lon Hteik Htar Condo",
    parcelWeight: "1.0",
    parcelWeightUnit: "kg",
    codAmount: "1000",
    currency: "MMK",
    senderName: "May Boutique",
    deliveryInstructions: null,
    status: "CREATED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    owner: { id: "550e8400-e29b-41d4-a716-446655440001", fullName: "May Boutique", phone: "09123456789" },
    operator: { id: "550e8400-e29b-41d4-a716-446655440099", fullName: "Shwe Express", phone: "09123456789" },
  },
};

const statusPayload = {
  success: true,
  data: {
    id: orderId,
    orderCode,
    status: "CREATED",
    timeline: [
      { status: "CREATED", previousStatus: null, note: null, createdAt: new Date().toISOString() },
    ],
  },
};

const qrPayload = {
  success: true,
  data: {
    id: orderId,
    orderCode,
    qr: {
      identifier: "a".repeat(64),
      imageDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
    },
  },
};

function stubParcelApi() {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/status")) {
      return new Response(JSON.stringify(statusPayload), { status: 200 });
    }
    if (url.endsWith("/qr")) {
      return new Response(JSON.stringify(qrPayload), { status: 200 });
    }
    return new Response(JSON.stringify(detailPayload), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Parcel details content", () => {
  it("renders the shipment overview, timeline, QR label and costs from props", () => {
    render(
      <ParcelDetailsContent
        orderCode="PKG-1050"
        orderReference="Order ORD-1050"
        createdAtLabel="Just now"
        statusLabel="Booked"
        estimatedDelivery="Tomorrow · 10 AM–2 PM"
        deliveryService="Shwe Express"
        pickupName="May Boutique"
        pickupAddress="May Boutique · No. 18, Bogyoke Aung San Road, Yangon"
        recipientName="Aye Chan Myae Moe"
        deliveryAddress="Tower A Pin Lon Hteik Htar Condo, Bahan, Yangon"
        deliveryPhone="092388"
        timeline={[{ id: "booked", title: "Booked", detail: "Just now · Bahan, Yangon", active: true }]}
        weight="1.0 kg"
        deliveryFee="3,500 MMK"
        codAmount="1,000 MMK"
        assignedRider="Unassigned"
      />,
    );

    expect(screen.getByRole("heading", { name: "PKG-1050" })).toBeTruthy();
    expect(screen.getByText(/Order ORD-1050 · Created Just now/)).toBeTruthy();
    expect(screen.getAllByText("Booked")).toHaveLength(2);
    expect(screen.getByText("Estimated delivery")).toBeTruthy();
    expect(screen.getByText("Delivery service")).toBeTruthy();
    expect(screen.getByText("Pickup")).toBeTruthy();
    expect(screen.getByText("Delivery address")).toBeTruthy();
    expect(screen.getByText("092388")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tracking timeline" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Order QR label" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Parcel & costs" })).toBeTruthy();
    expect(screen.getByText("3,500 MMK")).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Preview public tracking/ })).toBeTruthy();
  });

  it("copies the order code to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<ParcelDetailsContent orderCode="PKG-1050" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy order code" }));
    expect(writeText).toHaveBeenCalledWith("PKG-1050");
  });
});

describe("Parcel details view", () => {
  it("loads the parcel detail, status and QR code", async () => {
    const fetchMock = stubParcelApi();
    render(<ParcelDetailsView identifier={orderId} />);

    expect(await screen.findByRole("heading", { name: orderCode })).toBeTruthy();
    expect(screen.getByText("Aye Chan Myae Moe")).toBeTruthy();
    expect(screen.getByText("Shwe Express")).toBeTruthy();
    expect(screen.getByText("1.0 kg")).toBeTruthy();
    expect(screen.getByText("1,000 MMK")).toBeTruthy();

    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls.some((url) => url.endsWith(`/api/session/orders/${orderId}`))).toBe(true);
    expect(urls.some((url) => url.endsWith(`/api/session/orders/${orderId}/status`))).toBe(true);
    expect(urls.some((url) => url.endsWith(`/api/session/orders/${orderId}/qr`))).toBe(true);
  });

  it("shows an error state when the parcel cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    render(<ParcelDetailsView identifier={orderId} />);

    expect(await screen.findByText("Parcel unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });
});
