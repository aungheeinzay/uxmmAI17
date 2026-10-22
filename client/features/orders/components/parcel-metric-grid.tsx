"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, CheckCircle2, Clock, Package, Truck, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ParcelMetricGridProps = {
  totalParcels: number;
  pendingPickup: number;
  atWarehouse: number;
  inTransit: number;
  delivered: number;
  failed: number;
  className?: string;
};

type MetricConfig = {
  label: string;
  value: number;
  icon: LucideIcon;
  badge: string;
  iconTone: string;
};

export function ParcelMetricGrid({
  totalParcels,
  pendingPickup,
  atWarehouse,
  inTransit,
  delivered,
  failed,
  className,
}: ParcelMetricGridProps) {
  const metrics: MetricConfig[] = [
    { label: "Total parcels", value: totalParcels, icon: Package, badge: "bg-brand-tint", iconTone: "text-brand" },
    { label: "Pending pickup", value: pendingPickup, icon: Clock, badge: "bg-warning-soft", iconTone: "text-warning" },
    { label: "At warehouse", value: atWarehouse, icon: Building2, badge: "bg-brand-tint", iconTone: "text-brand" },
    { label: "In transit", value: inTransit, icon: Truck, badge: "bg-info-soft", iconTone: "text-info" },
    { label: "Delivered", value: delivered, icon: CheckCircle2, badge: "bg-success-soft", iconTone: "text-success" },
    { label: "Failed / returned", value: failed, icon: XCircle, badge: "bg-danger-soft", iconTone: "text-danger" },
  ];

  return (
    <section
      aria-label="Parcel metrics"
      className={cn("grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6", className)}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card
            key={metric.label}
            className="h-36 justify-between border-border bg-card p-4 shadow-card [--radius-card:16px]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-muted-foreground">{metric.label}</p>
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", metric.badge)}>
                <Icon aria-hidden="true" className={cn("size-4", metric.iconTone)} />
              </span>
            </div>
            <p className="text-heading-1 font-bold tabular-nums text-foreground">{metric.value}</p>
            <p className="text-[11px] text-muted-foreground/70">Across all shipments</p>
          </Card>
        );
      })}
    </section>
  );
}
