import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeliveryProviders } from "@/features/operator/components/delivery-providers";
import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { useAuthStore } from "@/stores/auth.store";
import { cityPriceInputSchema } from "@/features/operator/types/provider.types";
const id = "550e8400-e29b-41d4-a716-446655440000", priceId = "660e8400-e29b-41d4-a716-446655440000";
const row = { id, name: "Flash Deliver", isActive: true, cityPrices: [{ id: priceId, providerId: id, city: "yangon", fee: "3500.00", currency: "MMK", isActive: true, createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z" }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); useAuthStore.setState({ user: null, status: "loading", revision: 0 }); });
function setup(provider: unknown = row) {
  useAuthStore.getState().setUser({ id, role: "OPERATOR", fullName: "Operator", phone: null });
  const fetcher = vi.fn().mockImplementation(async (_url, init) => {
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify({ success: true, data: body.action === "list" ? { provider } : row.cityPrices[0] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher); render(<DeliveryProviders />); return fetcher;
}
it("normalizes cities and rejects malformed decimal fees", () => {
  expect(cityPriceInputSchema.parse({ city: " YANGON ", fee: "3500.00", isActive: true }).city).toBe("yangon");
  for (const fee of ["-1", "1.001", "10000000000"]) expect(cityPriceInputSchema.safeParse({ city: "Yangon", fee, isActive: true }).success).toBe(false);
});
it("shows setup required and no mutation form for unconfigured Operators", async () => {
  setup(null);
  expect(await screen.findByText("Your delivery provider has not been configured.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add City Pricing" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Create provider" })).toBeNull();
});
it("shows read-only provider and adds city pricing without a provider selector or ID", async () => {
  const fetcher = setup({ ...row, cityPrices: [] }), user = userEvent.setup();
  expect(await screen.findByRole("heading", { name: "Flash Deliver" })).toBeTruthy();
  expect(screen.queryByLabelText("Provider name")).toBeNull();
  expect(screen.queryByLabelText("Active provider")).toBeNull();
  expect(screen.getByText(/No city prices yet/)).toBeTruthy();
  await user.type(screen.getByLabelText("City"), " Mandalay ");
  await user.type(screen.getByLabelText("Fixed fee (MMK)"), "6000.00");
  await user.click(screen.getByRole("button", { name: "Add City Pricing" }));
  await waitFor(() => expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body))).toContainEqual({ action: "create", city: "mandalay", fee: "6000.00", isActive: true }));
});
it("edits and toggles city pricing by priceId only", async () => {
  const fetcher = setup(), user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Edit yangon" }));
  await user.clear(screen.getByLabelText("Fixed fee (MMK)")); await user.type(screen.getByLabelText("Fixed fee (MMK)"), "4000.25");
  await user.click(screen.getByRole("button", { name: "Save City Pricing" }));
  await waitFor(() => expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body))).toContainEqual({ action: "update", priceId, city: "yangon", fee: "4000.25", isActive: true }));
  await user.click(await screen.findByRole("button", { name: "Deactivate yangon" }));
  await waitFor(() => expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body))).toContainEqual({ action: "update", priceId, isActive: false }));
});
it("displays duplicate-city errors and retry", async () => {
  setup({ ...row, cityPrices: [] }); const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Flash Deliver" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "CITY_PRICE_CONFLICT" } }), { status: 409 })));
  await user.type(screen.getByLabelText("City"), "Yangon"); await user.type(screen.getByLabelText("Fixed fee (MMK)"), "3500");
  await user.click(screen.getByRole("button", { name: "Add City Pricing" }));
  expect(await screen.findByText(/Pricing already exists for this city/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});
it("profile displays account email and read-only provider membership", () => {
  useAuthStore.getState().setUser({ id, role: "OPERATOR", fullName: "Operator", phone: "123", email: "operator@example.test", providerId: id, provider: { id, name: "Flash Deliver", isActive: true } });
  render(<ProfileSettingsForm />);
  expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("operator@example.test");
  expect((screen.getByLabelText("Delivery Provider") as HTMLInputElement).value).toBe("Flash Deliver");
  expect((screen.getByLabelText("Delivery Provider") as HTMLInputElement).readOnly).toBe(true);
});
