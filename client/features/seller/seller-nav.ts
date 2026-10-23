import type { LucideIcon } from "lucide-react";
import { CreditCard, GitFork, Package, Search, Settings, Users } from "lucide-react";

export type SellerNavItem = {
  label: string;
  icon: LucideIcon;
  /** Destination. Items without one are shown as unavailable instead of a dead link. */
  href?: string;
  /** Paths that mark the item as the current page. */
  paths: string[];
  /** Marks the live feed row in the design. */
  live?: boolean;
};

export const sellerOperationsNav: SellerNavItem[] = [
  {
    label: "Parcels",
    icon: Package,
    href: "/seller",
    paths: ["/seller", "/seller/all-parcels", "/seller/order/new"],
    live: true,
  },
  // { label: "Dispatch", icon: GitFork, paths: [] },
  { label: "Tracking", icon: Search, href: "/seller/tracking", paths: ["/seller/tracking"] },
  { label: "Reports", icon: CreditCard, paths: [] },
  { label: "Settings", icon: Settings, href: "/seller/settings", paths: ["/seller/settings"] },
];

export const sellerDeliveryTeamNav: SellerNavItem[] = [{ label: "Delivery Team", icon: Users, paths: [] }];

const sellerNavItems = [...sellerOperationsNav, ...sellerDeliveryTeamNav];

type SellerPage = {
  title: string;
  paths: string[];
  /** Marks pages that only show estimated, demo data. */
  demoBadge?: boolean;
};

const sellerPageOverrides: SellerPage[] = [
  { title: "Create a parcel", paths: ["/seller/order/new"], demoBadge: true },
];

const sellerPages: SellerPage[] = [
  ...sellerPageOverrides,
  ...sellerNavItems.map((item) => ({ title: item.label, paths: item.paths })),
];

export type SellerPageMeta = {
  /** Title of the sidebar tab that owns the given path, used by the header breadcrumb. */
  title: string;
  /** Whether the header shows the demo data badge for the given path. */
  demoBadge: boolean;
};

export function sellerPageMeta(pathname: string): SellerPageMeta {
  const page = sellerPages.find((entry) => entry.paths.includes(pathname));
  return { title: page?.title ?? "Parcels", demoBadge: page?.demoBadge ?? false };
}
