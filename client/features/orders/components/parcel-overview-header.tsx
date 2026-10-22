"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
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

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getClientHour() {
  return new Date().getHours();
}

function getServerHour() {
  return 12;
}

function subscribeToHourChange(onStoreChange: () => void) {
  const now = new Date();
  const delay = (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000;
  const timeout = window.setTimeout(onStoreChange, delay);
  return () => window.clearTimeout(timeout);
}

export function ParcelOverviewHeader({
  userName,
  eyebrow = "Parcel operations · Yangon",
  totalParcels,
  activeView,
  onViewChange,
  actions,
  className,
}: ParcelOverviewHeaderProps) {
  const hour = useSyncExternalStore(subscribeToHourChange, getClientHour, getServerHour);
  const greeting = greetingFor(hour);

  const firstName = userName?.trim().split(/\s+/)[0] || "Thiri";

  const views: { id: ParcelOverviewView; label: string }[] = [
    { id: "overview", label: "Parcel view" },
    { id: "recent", label: "Recent shipments" },
    { id: "all", label: "All Shipments" },
  ];

  return (
    <section aria-labelledby="parcel-overview-heading" className={cn("space-y-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</p>
          <h1 id="parcel-overview-heading" className="text-heading-1 font-bold tracking-tight text-brand-dark">
            {greeting}, {firstName}
          </h1>
          <p className="text-body-md text-muted-foreground">Here’s what’s happening with your deliveries today.</p>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <Button
            asChild
            variant="default"
            size="lg"
            className="h-auto rounded-xl px-5 py-2.5 font-semibold"
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
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-card"
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
                "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-body-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                active ? "bg-brand font-semibold text-primary-foreground" : "text-foreground hover:text-brand-dark",
              )}
            >
              {view.label}
              {view.id === "all" ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-body-sm font-medium",
                    active ? "bg-white/20 text-primary-foreground" : "bg-muted text-neutral-strong",
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
