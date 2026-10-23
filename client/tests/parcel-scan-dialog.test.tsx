import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ParcelScanDialog } from "@/features/deliveries/components/parcel-scan-dialog";

const decoder = vi.hoisted(() => ({
  decode: vi.fn(async () => ({ stop: vi.fn() })),
}));

vi.mock("@zxing/browser", () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoElement = decoder.decode;
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps the dialog usable when no camera API exists", async () => {
  render(<ParcelScanDialog open onOpenChange={vi.fn()} onCompleted={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "Scan Parcel QR Code" })).toBeTruthy();
  expect(screen.getByLabelText("Manual parcel code fallback")).toBeTruthy();
  expect((await screen.findByRole("alert")).textContent).toMatch(/No camera detected/);
});

it("attaches a camera stream and releases it when the dialog closes", async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  const { rerender } = render(<ParcelScanDialog open onOpenChange={vi.fn()} onCompleted={vi.fn()} />);
  await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
  await waitFor(() => expect(decoder.decode).toHaveBeenCalled());
  rerender(<ParcelScanDialog open={false} onOpenChange={vi.fn()} onCompleted={vi.fn()} />);
  await waitFor(() => expect(stop).toHaveBeenCalled());
});
