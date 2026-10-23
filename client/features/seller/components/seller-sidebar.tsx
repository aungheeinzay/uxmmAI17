"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Sparkles } from "lucide-react";
import {
  sellerDeliveryTeamNav,
  sellerOperationsNav,
  type SellerNavItem,
} from "../seller-nav";
import { cn } from "@/lib/utils";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { roleLabels } from "@/features/auth/role-routes";
import { BrandLogo } from "@/components/shared/brand-logo";

function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/seller"
      onClick={onNavigate}
      className="flex w-full items-center rounded-xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
    >
      <span className="flex items-center gap-2">
        <BrandLogo className="size-10 shrink-0" priority />
        <span className="text-lg font-bold tracking-tight text-white" aria-label="SURFERTrack">
          SURFER<span className="text-white/70">Track</span>
        </span>
      </span>
    </Link>
  );
}

function WorkspaceCard() {
  const user = useAuthStore((state) => state.user);
  const name = user?.fullName?.trim() || "Seller workspace";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "SME";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#334668] bg-[#24396B] px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#334668] text-[13px] font-bold text-white">
        {initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-white">{name}</span>
        <span className="truncate text-[11px] text-[#9CA3AF]">
          {roleLabels[user?.role ?? "SME"]}
        </span>
      </span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-[#9CA3AF]" />
    </div>
  );
}

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: SellerNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const base = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors";
  const tone = active
    ? "bg-[#334668] text-white shadow-sm"
    : "text-[#D1D5DB] hover:bg-white/10 hover:text-white";
  const content = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.live && active ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#34D399]" />
      ) : null}
    </>
  );

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} is not available yet`}
        className={cn(base, "cursor-not-allowed text-[#9CA3AF] opacity-60")}
      >
        {content}
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#9CA3AF]">Soon</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(base, tone, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70")}
    >
      {content}
    </Link>
  );
}

function NavSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: SellerNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">{title}</p>
      {items.map((item) => (
        <SidebarLink
          key={item.label}
          item={item}
          active={item.paths.includes(pathname)}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

export function SellerSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { logout, isPending } = useLogout();

  return (
    <aside className="flex h-full w-64 flex-col bg-[#1B2F5A] text-white">
      <div className="flex flex-col gap-4 px-4 pt-6 pb-5">
        <SidebarBrand onNavigate={onNavigate} />
        <WorkspaceCard />
      </div>

      <nav aria-label="Seller" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
        <NavSection
          title="Operations"
          items={sellerOperationsNav}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <NavSection
          title="Delivery"
          items={sellerDeliveryTeamNav}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="px-3 pb-4">
        <div className="rounded-xl border border-[#334668] bg-[#24396B] p-3">
          <div className="flex items-start gap-2">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#34D399]" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-white">Prototype</p>
              <p className="text-[11px] leading-relaxed text-[#D1D5DB]">
                Demo data only. Parcel updates are not saved to a live carrier system.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-white/10 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onNavigate?.();
              void logout();
            }}
            disabled={isPending}
            className="w-full justify-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-[#F1F5F9] hover:text-[#1B2F5A] disabled:opacity-60"
          >
            <LogOut aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Sign out</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
