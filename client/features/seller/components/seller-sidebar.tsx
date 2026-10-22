"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Sparkles } from "lucide-react";
import {
  sellerDeliveryTeamNav,
  sellerOperationsNav,
  sellerWorkspace,
  type SellerNavItem,
} from "../seller-nav";
import { cn } from "@/lib/utils";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { Button } from "@/components/ui/button";

function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/seller"
      onClick={onNavigate}
      className="flex w-full items-center rounded-lg bg-white px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
    >
      <Image
        src="/images/logo.png"
        alt="SURFERTrack"
        width={1280}
        height={295}
        sizes="224px"
        className="h-auto w-full"
      />
    </Link>
  );
}

function WorkspaceCard() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-nav-border bg-nav-card px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-nav-text">
        MB
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold text-nav-text">{sellerWorkspace.name}</span>
        <span className="truncate text-[11px] text-nav-text-subtle">
          {sellerWorkspace.location} · {sellerWorkspace.role}
        </span>
      </span>
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
  const base = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors";
  const tone = active
    ? "bg-nav-active text-nav-text"
    : "text-nav-text-muted hover:bg-white/5 hover:text-nav-text";
  const content = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.live && active ? (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-nav-accent" />
      ) : null}
    </>
  );

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} is not available yet`}
        className={cn(base, tone, "cursor-not-allowed opacity-60")}
      >
        {content}
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-nav-text-subtle">Soon</span>
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
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-nav-text-subtle">{title}</p>
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
    <aside className="flex h-full w-64 flex-col bg-nav-surface text-nav-text">
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
        <div className="rounded-xl border border-nav-border bg-nav-card p-3">
          <div className="flex items-start gap-2">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-nav-accent" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold text-nav-text">Prototype</p>
              <p className="text-[11px] leading-relaxed text-nav-text-muted">
                Demo data only. Parcel updates are not saved to a live carrier system.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-nav-border pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onNavigate?.();
              void logout();
            }}
            disabled={isPending}
            className="mt-1 w-full justify-start gap-2.5 rounded-lg px-2 py-2 text-[13px] font-medium text-nav-text-muted hover:bg-white/5 hover:text-nav-text disabled:opacity-60"
          >
            <span className="min-w-0 flex-1 truncate text-center">Logout</span>
            <LogOut aria-hidden="true" className="size-4 shrink-0" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
