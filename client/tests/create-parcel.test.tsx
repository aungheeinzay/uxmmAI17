import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CreateParcel } from "@/features/orders/components/create-parcel";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/seller/order/new" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  pathname.current = "/seller/order/new";
});

it("shows the create a parcel page header", () => {
  render(<CreateParcel />);

  expect(screen.getByRole("heading", { level: 1, name: "Create a parcel" })).toBeTruthy();
  expect(screen.getByText(/Parcels · New shipment/)).toBeTruthy();
});

it("links back to the parcel list", () => {
  render(<CreateParcel />);

  const back = screen.getByRole("link", { name: /Back to parcels/ });
  expect(back.getAttribute("href")).toBe("/seller");
});
