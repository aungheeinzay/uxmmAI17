"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Check, Clock, Package, Truck, X } from "lucide-react";
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
    { label: "Total parcels", value: totalParcels, icon: Package, badge: "bg-[#EEF2FF]", iconTone: "text-[#3D51A3]" },
    { label: "Pending pickup", value: pendingPickup, icon: Clock, badge: "bg-[#FEF3C7]", iconTone: "text-[#D97706]" },
    { label: "At warehouse", value: atWarehouse, icon: Building2, badge: "bg-[#E0F2FE]", iconTone: "text-[#0369A1]" },
    { label: "In transit", value: inTransit, icon: Truck, badge: "bg-[#DBEAFE]", iconTone: "text-[#2563EB]" },
    { label: "Delivered", value: delivered, icon: Check, badge: "bg-[#D1FAE5]", iconTone: "text-[#059669]" },
    { label: "Failed / returned", value: failed, icon: X, badge: "bg-[#FEE2E2]", iconTone: "text-[#DC2626]" },
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
            className="h-36 justify-between gap-0 rounded-[12px] border border-[#d3d9e0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_20px_rgba(27,47,90,0.06)] ring-0"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-[#6B7280]">{metric.label}</p>
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", metric.badge)}>
                <Icon aria-hidden="true" className={cn("size-4", metric.iconTone)} />
              </span>
            </div>
            <p className="text-[28px] leading-9 font-bold tabular-nums text-[#1B2F5A]">{metric.value}</p>
            <p className="text-[11px] text-[#9CA3AF]">Across all shipments</p>
          </Card>
        );
      })}
    </section>
  );
}
