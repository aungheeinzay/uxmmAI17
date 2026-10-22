import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeliveryProviders } from "@/features/operator/components/delivery-providers";
import { useAuthStore } from "@/stores/auth.store";
import { cityPriceInputSchema } from "@/features/operator/types/provider.types";
const id = "550e8400-e29b-41d4-a716-446655440000";
const row = { id, name: "Test Express", isActive: true, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z", cityPrices: [{ id, providerId: id, city: "yangon", fee: "3500.00", currency: "MMK", isActive: true, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z" }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });
function setup(providers: unknown[] = [row]) {
  useAuthStore.getState().setUser({ id, role: "OPERATOR", fullName: "Operator", phone: null });
  const fetcher = vi.fn().mockImplementation(async (_url, init) => {
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify({ success: true, data: body.action === "list" ? { providers } : row }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher); render(<DeliveryProviders />); return fetcher;
}
it("normalizes cities and validates decimal fees", () => {
  expect(cityPriceInputSchema.parse({ city: " YANGON ", fee: "3500.00", isActive: true }).city).toBe("yangon");
  for (const fee of ["-1", "1.001", "10000000000"]) expect(cityPriceInputSchema.safeParse({ city: "Yangon", fee, isActive: true }).success).toBe(false);
});
it("shows real empty state and creates providers through the session", async () => {
  const fetcher = setup([]), user = userEvent.setup();
  expect(await screen.findByText(/No providers yet/)).toBeTruthy();
  await user.type(screen.getByLabelText("New provider name"), "New Express");
  await user.click(screen.getByRole("button", { name: "Create provider" }));
  await waitFor(() => expect(fetcher.mock.calls.some(call => JSON.parse(call[1].body).action === "create")).toBe(true));
  expect(await screen.findByRole("status")).toBeTruthy();
});
it("loads city prices and submits a disabled price with a normalized city", async () => {
  const fetcher = setup(), user = userEvent.setup();
  expect(await screen.findByText("3500.00")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Edit city price" }));
  await user.clear(screen.getByLabelText("Fixed fee (MMK)"));
  await user.type(screen.getByLabelText("Fixed fee (MMK)"), "4000.25");
  await user.click(screen.getByLabelText("Active city price"));
  await user.click(screen.getByRole("button", { name: "Save city price" }));
  await waitFor(() => expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body))).toContainEqual({ action: "price", id, city: "yangon", fee: "4000.25", isActive: false }));
});
it("shows validation and server conflict errors", async () => {
  setup([]); const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Create provider" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "PROVIDER_CONFLICT" } }), { status: 409 })));
  await user.type(screen.getByLabelText("New provider name"), "Duplicate");
  await user.click(screen.getByRole("button", { name: "Create provider" }));
  expect(await screen.findByText(/A provider with that name already exists/)).toBeTruthy();
});
