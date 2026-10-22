"use client";

import { ChevronRight, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RecentShipmentsCalloutProps = {
  /** Called when the visitor asks to see the recent shipments list. */
  onViewRecentShipments: () => void;
  className?: string;
};

export function RecentShipmentsCallout({
  onViewRecentShipments,
  className,
}: RecentShipmentsCalloutProps) {
  return (
    <Card
      className={cn(
        "border-border bg-card px-6 py-6 shadow-card [--radius-card:16px]",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="space-y-1">
          <h2 className="text-heading-3 font-bold tracking-tight text-foreground">Recent shipments</h2>
          <p className="text-body-md text-muted-foreground">
            Open the latest parcel activity when you need a quick check.
          </p>
        </div>

        <Button
          onClick={onViewRecentShipments}
          className="h-auto gap-2 rounded-full bg-brand-dark px-5 py-2.5 text-body-md font-semibold transition-colors hover:bg-[#111C38]"
        >
          <PackageCheck aria-hidden="true" className="size-[18px]" />
          View recent shipments
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
