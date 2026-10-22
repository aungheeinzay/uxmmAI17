"use client";

import { Bell, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, initialsFor } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";

type SellerHeaderProps = {
  /** Workspace shown as the first breadcrumb crumb. */
  workspaceName: string;
  /** Title of the page the workspace tab is showing. */
  currentPageName: string;
  /** Marks pages that only show estimated, demo data. */
  showDemoBadge?: boolean;
  /** Opens the workspace navigation drawer on small screens. */
  onOpenNavigation?: () => void;
  className?: string;
};

export function SellerHeader({
  workspaceName,
  currentPageName,
  showDemoBadge,
  onOpenNavigation,
  className,
}: SellerHeaderProps) {
  const user = useAuthStore((state) => state.user);
  const displayName = user?.fullName?.trim() || "Seller";

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-[#E5E7EB] bg-white px-4 sm:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-body-md">
        {onOpenNavigation ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 lg:hidden"
            aria-label="Open navigation"
            onClick={onOpenNavigation}
          >
            <Menu aria-hidden="true" />
          </Button>
        ) : null}
        <span className="truncate text-[#6B7280]">{workspaceName}</span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[#9CA3AF]" />
        <span className="truncate font-semibold text-[#1B2F5A]">{currentPageName}</span>
      </div>

      <div className="flex items-center gap-4">
        {showDemoBadge ? (
          <span className="hidden rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3D51A3] sm:inline-flex">
            Demo data
          </span>
        ) : null}
        <button
          type="button"
          disabled
          aria-label="Notifications"
          title="No new notifications"
          className="relative flex size-9 items-center justify-center rounded-full text-[#4B5563] transition-colors hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Bell aria-hidden="true" className="size-5" />
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500" />
        </button>
        <span
          role="img"
          aria-label={displayName}
          className="flex size-9 items-center justify-center rounded-full bg-[#E8EDF7] text-body-md font-bold text-[#1B2F5A]"
        >
          {initialsFor(user?.fullName ?? null, "SO")}
        </span>
      </div>
    </header>
  );
}
