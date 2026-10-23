"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ParcelDetailsTimelineStep = {
  id: string;
  title: string;
  detail: string;
  active?: boolean;
};

export type ParcelDetailsContentProps = {
  orderCode?: string;
  orderReference?: string;
  createdAtLabel?: string;
  statusLabel?: string;
  estimatedDelivery?: string;
  deliveryService?: string;
  pickupName?: string;
  pickupAddress?: string;
  recipientName?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  timeline?: ParcelDetailsTimelineStep[];
  qrImageDataUrl?: string | null;
  weight?: string;
  deliveryFee?: string;
  codAmount?: string;
  assignedRider?: string;
  onUpdateStatus?: () => void;
  onAssignRider?: () => void;
  onMessage?: () => void;
};

const defaultTimeline: ParcelDetailsTimelineStep[] = [
  { id: "booked", title: "Booked", detail: "Just now", active: true },
];

export function ParcelDetailsContent({
  orderCode = "PKG-1050",
  orderReference = "Order ORD-1050",
  createdAtLabel = "Just now",
  statusLabel = "Booked",
  estimatedDelivery = "Not available",
  deliveryService = "Not available",
  pickupName = "Not available",
  pickupAddress = "Not available",
  recipientName = "Not available",
  deliveryAddress = "Not available",
  deliveryPhone = "Not available",
  timeline = defaultTimeline,
  qrImageDataUrl = null,
  weight = "1.0 kg",
  deliveryFee = "Not available",
  codAmount = "Not available",
  assignedRider = "Unassigned",
}: ParcelDetailsContentProps) {
  const [copied, setCopied] = useState(false);

  async function copyOrderCode() {
    try {
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-8">
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[24px] font-bold leading-tight text-[#1B2F5A]">{orderCode}</h2>
              <p className="mt-1 text-[13px] text-[#6B7280]">
                {orderReference} · Created {createdAtLabel}
              </p>
            </div>
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-[#E2E8F0] px-3 py-1 text-xs font-medium text-[#475569]">
              <span className="size-1.5 rounded-full bg-[#64748B]" aria-hidden="true" />
              {statusLabel}
            </span>
          </div>

          <div className="my-6 grid grid-cols-2 gap-4 rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] p-4">
            <div>
              <p className="text-[12px] text-[#6B7280]">Estimated delivery</p>
              <p className="mt-0.5 text-[14px] font-bold text-[#111827]">{estimatedDelivery}</p>
            </div>
            <div>
              <p className="text-[12px] text-[#6B7280]">Delivery service</p>
              <p className="mt-0.5 text-[14px] font-bold text-[#111827]">{deliveryService}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <div className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-3.5 text-[#6B7280]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Pickup</p>
              </div>
              <p className="mt-3 text-[14px] font-bold text-[#111827]">{pickupName}</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6B7280]">{pickupAddress}</p>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] p-4">
              <div className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-3.5 text-[#6B7280]" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Delivery address
                </p>
              </div>
              <p className="mt-3 text-[14px] font-bold text-[#111827]">{recipientName}</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6B7280]">{deliveryAddress}</p>
              <p className="mt-1 text-[13px] text-[#6B7280]">{deliveryPhone}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[16px] font-bold text-[#111827]">Tracking timeline</h3>
              <p className="mt-1 text-[13px] text-[#6B7280]">Latest movement and handoff history.</p>
            </div>
            <Clock aria-hidden="true" className="size-5 shrink-0 text-[#9CA3AF]" />
          </div>

          <ol className="mt-6">
            {timeline.map((step, index) => {
              const isLast = index === timeline.length - 1;
              return (
                <li key={step.id} className={cn("relative flex gap-3", !isLast && "pb-6")}>
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-[11px] top-7 h-[calc(100%-1rem)] w-px bg-[#E5E7EB]"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-white",
                      step.active ? "border-[#10B981]" : "border-[#D1D5DB]",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        step.active ? "bg-[#10B981]" : "bg-[#D1D5DB]",
                      )}
                    />
                  </span>
                  <div>
                    <p className="text-[14px] font-bold text-[#111827]">{step.title}</p>
                    <p className="mt-0.5 text-[13px] text-[#6B7280]">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <div className="space-y-6 lg:col-span-4">
        <section className="flex flex-col items-center rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex w-full items-start justify-between gap-4">
            <div>
              <h3 className="text-[16px] font-bold text-[#111827]">Order QR label</h3>
              <p className="mt-1 text-[13px] text-[#6B7280]">Scan to open this parcel in the rider app.</p>
            </div>
            <QrCode aria-hidden="true" className="size-5 shrink-0 text-[#6B7280]" />
          </div>

          <div className="my-6 flex w-full items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            {qrImageDataUrl ? (
              <Image
                src={qrImageDataUrl}
                alt={`QR code for ${orderCode}`}
                width={192}
                height={192}
                unoptimized
                className="size-48"
              />
            ) : (
              <QrCode aria-hidden="true" className="size-48 text-[#CBD5E1]" />
            )}
          </div>

          <div className="mb-4 flex w-full items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white">
                <QrCode aria-hidden="true" className="size-4 text-[#6B7280]" />
              </span>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">Order code</p>
                <p className="text-[14px] font-bold text-[#111827]">{orderCode}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={copyOrderCode}
              aria-label={copied ? "Order code copied" : "Copy order code"}
              className="rounded-md p-1.5 text-[#6B7280] transition-colors hover:bg-[#EEF2FF] hover:text-[#3D51A3]"
            >
              {copied ? <Check aria-hidden="true" className="size-[18px]" /> : <Copy aria-hidden="true" className="size-[18px]" />}
            </button>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-auto w-full gap-2 rounded-xl border-[#E5E7EB] bg-white py-3 text-[14px] font-semibold text-[#111827] hover:bg-gray-50"
          >
            <Link href="/seller/tracking">
              <ShieldCheck aria-hidden="true" className="size-[18px]" />
              Preview public tracking
            </Link>
          </Button>

          <Button
              type="button"
              onClick={() => {}}
              className="h-auto w-full mt-2 gap-2 rounded-xl bg-[#3D51A3] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#32438A]"
            >
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Print Receipt
          </Button>

        </section>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-[16px] font-bold text-[#111827]">Parcel &amp; costs</h3>
          <dl className="divide-y divide-[#F3F4F6]">
            <div className="flex items-center justify-between py-2 text-[14px]">
              <dt className="text-[#6B7280]">Weight</dt>
              <dd className="font-bold text-[#111827]">{weight}</dd>
            </div>
            <div className="flex items-center justify-between py-2 text-[14px]">
              <dt className="text-[#6B7280]">Delivery fee</dt>
              <dd className="font-bold text-[#111827]">{deliveryFee}</dd>
            </div>
            <div className="flex items-center justify-between py-2 text-[14px]">
              <dt className="text-[#6B7280]">COD amount</dt>
              <dd className="font-bold text-[#111827]">{codAmount}</dd>
            </div>
            <div className="flex items-center justify-between py-2 text-[14px]">
              <dt className="text-[#6B7280]">Assigned rider</dt>
              <dd className="text-[#6B7280]">{assignedRider}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
