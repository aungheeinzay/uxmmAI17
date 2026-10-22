"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, LoaderCircle, LogOut, Truck, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, initialsFor } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "../hooks/use-logout";
import { roleLabels, roleRoutes, type UserRole } from "../role-routes";

type NavItem = { href: string; label: string; icon: LucideIcon };

function navItemsFor(role: UserRole): NavItem[] {
  const items: NavItem[] = [{ href: roleRoutes[role], label: "Dashboard", icon: LayoutDashboard }];
  if (role === "OPERATOR") items.push({ href: "/operator/riders", label: "Riders", icon: Users });
  items.push({ href: "/account", label: "Account", icon: UserRound });
  return items;
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <>
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-body-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              active ? "bg-brand-tint text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function AppHeader({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const items = navItemsFor(role);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={roleRoutes[role]}
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-sm">
            <Truck aria-hidden="true" className="size-5" />
          </span>
          <span className="text-heading-3 font-bold tracking-tight text-foreground">
            SURFER<span className="text-brand">Track</span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 md:flex">
          <NavLinks items={items} pathname={pathname} />
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 shadow-card sm:flex">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-tint text-body-sm font-semibold text-brand">
              {initialsFor(user?.fullName ?? null)}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="max-w-32 truncate text-body-sm font-semibold text-foreground">
                {user?.fullName ?? "Signed in"}
              </span>
              <span className="text-caption text-muted-foreground">{roleLabels[role]} workspace</span>
            </span>
          </span>
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-tint text-body-sm font-semibold text-brand sm:hidden">
            {initialsFor(user?.fullName ?? null)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={logout.logout}
            disabled={logout.isPending}
            aria-label={logout.isPending ? "Signing out" : "Sign out"}
            title={logout.isPending ? "Signing out" : "Sign out"}
            className="size-9"
          >
            {logout.isPending ? (
              <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
            ) : (
              <LogOut aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      <nav aria-label="Primary mobile" className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        <NavLinks items={items} pathname={pathname} />
      </nav>
    </header>
  );
}
