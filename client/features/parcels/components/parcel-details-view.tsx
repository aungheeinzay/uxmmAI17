"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shipmentStatusBadges } from "@/features/orders/components/tracking-status";
import type { OrderStatus } from "@/features/orders/schemas/order-list.schema";
import { useParcelDetails } from "../hooks/use-parcel-details";
import { ParcelDetailsContent, type ParcelDetailsTimelineStep } from "./parcel-details-content";

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatRelative(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return "Just now";
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeFormatter.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relativeFormatter.format(months, "month");
  return relativeFormatter.format(Math.round(months / 12), "year");
}

function formatMoney(amount: string, currency: string) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${amount} ${currency}`;
  return `${numeric.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
}

function buildTimeline(
  entries: { status: OrderStatus; note: string | null; createdAt: string }[],
  township: string,
): ParcelDetailsTimelineStep[] {
  return entries
    .slice()
    .reverse()
    .map((entry, index, ordered) => ({
      id: `${entry.status}-${entry.createdAt}`,
      title: shipmentStatusBadges[entry.status].label,
      detail: `${formatRelative(entry.createdAt)} · ${entry.note ?? township}`,
      active: index === 0 && ordered.length > 0,
    }));
}

export function ParcelDetailsView({ identifier }: { identifier: string }) {
  const { detail, status, qr, isLoading, hasError, refresh } = useParcelDetails(identifier);

  if (hasError) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#FEF2F2] text-[#B91C1C]">
            <AlertCircle aria-hidden="true" className="size-6" />
          </span>
          <p className="text-[18px] font-bold text-[#111827]">Parcel unavailable</p>
          <p className="max-w-sm text-[14px] text-[#6B7280]">
            We couldn’t load this parcel. Check your connection and try again.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={refresh}
            className="mt-2 h-auto gap-2 rounded-xl border-[#E5E7EB] px-5 py-2.5 font-semibold"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !detail) {
    return (
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12" aria-busy="true" aria-label="Loading parcel details">
        <div className="space-y-6 lg:col-span-8">
          <div className="h-72 animate-pulse rounded-2xl border border-[#E5E7EB] bg-white" />
          <div className="h-44 animate-pulse rounded-2xl border border-[#E5E7EB] bg-white" />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="h-96 animate-pulse rounded-2xl border border-[#E5E7EB] bg-white" />
          <div className="h-52 animate-pulse rounded-2xl border border-[#E5E7EB] bg-white" />
        </div>
      </div>
    );
  }

  const currentStatus = status?.status ?? detail.status;
  const timelineEntries = status?.timeline.length
    ? status.timeline
    : [{ status: detail.status, note: null, createdAt: detail.createdAt }];

  return (
    <ParcelDetailsContent
      orderCode={detail.orderCode}
      orderReference={`Order ${detail.orderCode}`}
      createdAtLabel={formatRelative(detail.createdAt)}
      statusLabel={shipmentStatusBadges[currentStatus].label}
      deliveryService={detail.deliveryProvider?.name ?? "Not selected"}
      pickupName={detail.senderName}
      pickupAddress={detail.senderName}
      recipientName={detail.recipientName}
      deliveryAddress={`${detail.deliveryAddress}, ${detail.township}`}
      deliveryPhone={detail.phoneNumber}
      timeline={buildTimeline(timelineEntries, detail.township)}
      qrImageDataUrl={qr?.qr.imageDataUrl ?? null}
      weight={`${detail.parcelWeight} ${detail.parcelWeightUnit}`}
      deliveryFee={detail.deliveryFee ? formatMoney(detail.deliveryFee, detail.currency) : "Unavailable"}
      codAmount={formatMoney(detail.codAmount, detail.currency)}
    />
  );
}
