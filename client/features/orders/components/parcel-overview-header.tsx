"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ParcelOverviewView = "overview" | "recent" | "all";

type ParcelOverviewHeaderProps = {
  /** Signed-in shop owner name; the greeting uses the first name. */
  userName?: string | null;
  /** Small uppercase label above the greeting. */
  eyebrow?: string;
  /** Total parcel count shown next to the "All Shipments" link. */
  totalParcels: number;
  activeView: ParcelOverviewView;
  onViewChange: (view: ParcelOverviewView) => void;
  /** Extra actions rendered before the primary call to action. */
  actions?: React.ReactNode;
  className?: string;
};

export function ParcelOverviewHeader({
  userName,
  eyebrow = "Parcel operations",
  totalParcels,
  activeView,
  onViewChange,
  actions,
  className,
}: ParcelOverviewHeaderProps) {
  const greeting = "Welcome again";

  const firstName = userName?.trim().split(/\s+/)[0] || "Shop Owner";

  const views: { id: ParcelOverviewView; label: string }[] = [
    { id: "overview", label: "Parcel view" },
    { id: "recent", label: "Recent shipments" },
    { id: "all", label: "All Shipments" },
  ];

  return (
    <section aria-labelledby="parcel-overview-heading" className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">{eyebrow}</p>
          <h1 id="parcel-overview-heading" className="text-heading-1 font-bold tracking-tight text-[#1B2F5A]">
            {greeting}, {firstName}
          </h1>
          <p className="text-body-md text-[#6B7280]">Here’s what’s happening with your deliveries today.</p>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <Button
            asChild
            variant="brand"
            size="lg"
            className="h-auto rounded-[10px] px-5 py-2.5 font-semibold shadow-sm"
          >
            <Link href="/seller/order/new">
              <Plus aria-hidden="true" className="size-[18px]" />
              Create parcel
            </Link>
          </Button>
        </div>
      </div>

      <div
        role="group"
        aria-label="Dashboard views"
        className="inline-flex items-center gap-1 rounded-full bg-[#EEF2F7] p-1"
      >
        {views.map((view) => {
          const active = activeView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              aria-pressed={active}
              onClick={() => onViewChange(view.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B2F5A]",
                active
                  ? "bg-[#3D51A3] font-semibold text-white shadow-sm"
                  : "text-[#6B7280] hover:bg-white/70 hover:text-[#1B2F5A]",
              )}
            >
              {view.label}
              {view.id === "all" ? (
                <span
                  className={cn(
                    "min-w-6 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                    active ? "bg-white/15 text-white" : "bg-white text-[#1B2F5A] shadow-sm",
                  )}
                >
                  {totalParcels}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
