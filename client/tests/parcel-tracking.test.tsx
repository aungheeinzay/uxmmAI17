import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParcelTracking } from "@/features/orders/components/parcel-tracking";

const statusPayload = {
  success: true,
  data: {
    id: "3d0f2b7c-8a51-4c62-9f10-5b6c7d8e9f00",
    orderCode: "POAABBCCDDEEFF0011",
    status: "IN_TRANSIT",
    timeline: [
      { status: "CREATED", previousStatus: null, note: null, createdAt: "2026-10-20T00:00:00.000Z" },
      { status: "PICKED_UP", previousStatus: "CREATED", note: "Handed to operator", createdAt: "2026-10-20T02:15:00.000Z" },
      { status: "IN_TRANSIT", previousStatus: "PICKED_UP", note: null, createdAt: "2026-10-20T05:40:00.000Z" },
    ],
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function search(code: string) {
  await userEvent.type(screen.getByLabelText("Parcel or order code"), code);
  await userEvent.click(screen.getByRole("button", { name: /Track parcel/ }));
}

describe("Public tracking", () => {
  it("prompts for a code before any parcel is looked up", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ParcelTracking />);

    expect(screen.getByRole("heading", { name: /Public tracking/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No parcel tracked yet" })).toBeTruthy();
    expect(screen.getByText(/from your receipt/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the parcel status and shows the shipment status panel", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(statusPayload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ParcelTracking />);

    await search("POAABBCCDDEEFF0011");

    expect(await screen.findByText("POAABBCCDDEEFF0011")).toBeTruthy();
    expect(screen.getByText("In Transit")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Delivery Progress" })).toBeTruthy();

    const calledUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
    expect(calledUrl).toContain("/api/session/orders/POAABBCCDDEEFF0011/status");
  });

  it("validates the code format before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ParcelTracking />);

    await search("nope");
    expect((await screen.findByRole("alert")).textContent).toMatch(/valid parcel code/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains in the data section when no parcel matches the code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "ORDER_NOT_FOUND" } }), { status: 404 })));
    render(<ParcelTracking />);

    await search("POAABBCCDDEEFF9999");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/couldn’t find a parcel/i);
    expect(document.getElementById("tracking-data")?.contains(alert)).toBe(true);
  });

  it("explains in the data section when the tracking service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE" } }), { status: 500 })));
    render(<ParcelTracking />);

    await search("POAABBCCDDEEFF0011");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/temporarily unavailable/i);
    expect(document.getElementById("tracking-data")?.contains(alert)).toBe(true);
  });

  it("marks reached steps as completed and the next step as pending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(statusPayload), { status: 200 })));
    render(<ParcelTracking />);

    await search("POAABBCCDDEEFF0011");
    await screen.findByText("POAABBCCDDEEFF0011");

    expect(screen.getByText("Booked")).toBeTruthy();
    expect(screen.getByText("Picked Up")).toBeTruthy();
    expect(screen.getByText("In Transit to Destination")).toBeTruthy();
    expect(screen.getByText("Out for Delivery")).toBeTruthy();
    expect(screen.getAllByText("Completed")).toHaveLength(3);
  });

  it("renders the shipment status inside the tracking data section", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(statusPayload), { status: 200 })));
    render(<ParcelTracking />);

    await search("POAABBCCDDEEFF0011");
    await screen.findByText("POAABBCCDDEEFF0011");

    const trackingData = document.getElementById("tracking-data");
    expect(trackingData).toBeTruthy();
    expect(trackingData?.textContent).toContain("SHIPMENT STATUS");
    expect(trackingData?.textContent).toContain("Delivery Progress");
  });
});
