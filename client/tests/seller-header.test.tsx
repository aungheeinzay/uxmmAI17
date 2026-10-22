import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SellerHeader } from "@/features/seller/components/seller-header";
import { SellerShell } from "@/features/seller/components/seller-shell";
import { useAuthStore } from "@/stores/auth.store";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/seller" } }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  pathname.current = "/seller";
  useAuthStore.setState({ user: null, status: "loading", revision: 0 });
});

it("shows the workspace and the current page as a breadcrumb", () => {
  render(<SellerHeader workspaceName="May Boutique" currentPageName="Parcels" />);
  const header = screen.getByRole("banner");
  expect(within(header).getByText("May Boutique")).toBeTruthy();
  expect(within(header).getByText("Parcels")).toBeTruthy();
});

it("shows the signed-in shop owner initials in the avatar", () => {
  useAuthStore.getState().setUser({
    id: "550e8400-e29b-41d4-a716-446655440000",
    role: "SME",
    fullName: "Thiri Tun",
    phone: null,
  });
  render(<SellerHeader workspaceName="May Boutique" currentPageName="Parcels" />);
  expect(screen.getByText("TT")).toBeTruthy();
  expect(screen.getByLabelText("Thiri Tun")).toBeTruthy();
});

it("keeps the notification bell unavailable until notifications ship", () => {
  render(<SellerHeader workspaceName="May Boutique" currentPageName="Parcels" />);
  expect(screen.getByRole("button", { name: "Notifications" }).hasAttribute("disabled")).toBe(true);
});

it("opens the workspace navigation from the header on small screens", async () => {
  const onOpenNavigation = vi.fn();
  render(
    <SellerHeader
      workspaceName="May Boutique"
      currentPageName="Parcels"
      onOpenNavigation={onOpenNavigation}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(onOpenNavigation).toHaveBeenCalledTimes(1);
});

it("titles the breadcrumb with the active workspace tab", () => {
  pathname.current = "/seller/tracking";
  render(
    <SellerShell>
      <p>Parcel content</p>
    </SellerShell>,
  );
  const header = screen.getByRole("banner");
  expect(within(header).getByText("Seller workspace")).toBeTruthy();
  expect(within(header).getByText("Tracking")).toBeTruthy();
});

it("marks the new parcel page as demo data", () => {
  pathname.current = "/seller/order/new";
  render(
    <SellerShell>
      <p>Parcel content</p>
    </SellerShell>,
  );
  const header = screen.getByRole("banner");
  expect(within(header).getByText("Create a parcel")).toBeTruthy();
  expect(within(header).getByText("Demo data")).toBeTruthy();
});

it("keeps the demo data badge off approved workspace pages", () => {
  pathname.current = "/seller";
  render(
    <SellerShell>
      <p>Parcel content</p>
    </SellerShell>,
  );
  const header = screen.getByRole("banner");
  expect(within(header).queryByText("Demo data")).toBeNull();
});
