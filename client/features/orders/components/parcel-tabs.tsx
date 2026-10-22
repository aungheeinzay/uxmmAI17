"use client";

import { cn } from "@/lib/utils";
import type { OrderList, OrderTab } from "../schemas/order-list.schema";
import { orderTabs } from "./order-tabs";

type ParcelTabsProps = {
  activeTab: OrderTab;
  onTabChange: (tab: OrderTab) => void;
  counts: OrderList["tabCounts"] | null;
};

export function ParcelTabs({ activeTab, onTabChange, counts }: ParcelTabsProps) {
  return (
    <div role="tablist" aria-label="Parcel views" className="flex flex-wrap items-center gap-1 border-b border-border">
      {orderTabs.map((tab) => {
        const selected = tab.id === activeTab;
        const count = counts ? counts[tab.countKey] : null;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`parcel-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls="parcel-list-panel"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-body-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-body-sm font-semibold",
                selected ? "bg-brand-tint text-brand" : "bg-muted text-muted-foreground",
              )}
            >
              {count ?? "–"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
