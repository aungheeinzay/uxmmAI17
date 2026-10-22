"use client";

import { Check, CheckCircle2, Home, Lock, MapPin, Package, PackageCheck, Truck, X } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export type ShipmentStepIcon = "booked" | "picked" | "transit" | "delivered" | "exception";

export type ShipmentStep = {
  key: string;
  title: string;
  subtitle?: string | null;
  timestamp?: string | null;
  icon: ShipmentStepIcon;
  state: "completed" | "current" | "failed";
};

export type ShipmentStatusTone = "info" | "success" | "warning" | "danger" | "neutral";

export type ShipmentStatusPanelProps = {
  /** Optional heading rendered above the parcel summary. */
  title?: string;
  /** Parcel or order code shown in the summary card. */
  parcelId: string;
  /** Recipient line. Omitted when the viewer must not see it. */
  recipient?: string | null;
  /** Route line, for example "Mandalay → Yangon". */
  route?: string | null;
  /** Item metadata line, for example "Women T-Shirt (1) | 0.5 kg". */
  items?: string | null;
  /** Current status shown as a badge in the summary card. */
  status: { label: string; tone: ShipmentStatusTone };
  /** Ordered delivery progress steps. */
  steps: ShipmentStep[];
};

const statusToneClasses: Record<ShipmentStatusTone, string> = {
  info: "bg-[#E0EDFF] text-[#1D63ED]",
  success: "bg-[#DCFCE7] text-[#15803D]",
  warning: "bg-[#FEF3C7] text-[#B45309]",
  danger: "bg-[#FEE2E2] text-[#B91C1C]",
  neutral: "bg-muted text-neutral-strong",
};

const stepIcons: Record<ShipmentStepIcon, { icon: typeof Package; className: string }> = {
  booked: { icon: PackageCheck, className: "bg-[#DCFCE7] text-[#15803D]" },
  picked: { icon: Home, className: "bg-[#DCFCE7] text-[#15803D]" },
  transit: { icon: Truck, className: "bg-[#E0EDFF] text-[#1D63ED]" },
  delivered: { icon: Check, className: "bg-[#E0EDFF] text-[#1D63ED]" },
  exception: { icon: X, className: "bg-[#FEE2E2] text-[#B91C1C]" },
};

export function ShipmentStatusPanel({
  title,
  parcelId,
  recipient,
  route,
  items,
  status,
  steps,
}: ShipmentStatusPanelProps) {
  const headingId = useId();

  return (
    <div>
      {title ? <h2 className="text-[22px] font-bold text-[#0A192F]">{title}</h2> : null}

      <div
        className={cn(
          "flex items-start justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F4F7FF] p-4",
          title ? "mt-4" : "",
        )}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Package aria-hidden="true" className="size-5 text-[#0A192F]" />
            <p className="text-[16px] font-bold text-[#0A192F]">{parcelId}</p>
          </div>
          {recipient ? <p className="text-body-md text-[#64748B]">{recipient}</p> : null}
          {route ? (
            <p className="flex items-center gap-1.5 text-body-md text-[#475569]">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              {route}
            </p>
          ) : null}
          {items ? <p className="text-[13px] text-[#64748B]">{items}</p> : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold",
            statusToneClasses[status.tone],
          )}
        >
          {status.label}
        </span>
      </div>

      <section aria-labelledby={headingId} className="mt-6">
        <h3 id={headingId} className="mb-4 text-[18px] font-bold text-[#0A192F]">
          Delivery Progress
        </h3>
        <ol className="flex flex-col gap-4">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const isCurrent = step.state === "current";
            const isFailed = step.state === "failed";
            const StepIcon = stepIcons[step.icon].icon;

            return (
              <li key={step.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  {isCurrent ? (
                    <span
                      aria-hidden="true"
                      className="size-5 shrink-0 rounded-full border-4 border-[#1D63ED] bg-white"
                    />
                  ) : isFailed ? (
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#EF4444] text-white"
                    >
                      <X className="size-4" />
                    </span>
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="size-6 shrink-0 text-[#10B981]" />
                  )}
                  {!isLast ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1 w-0 flex-1 border-l-2 border-dashed",
                        isFailed ? "border-[#FCA5A5]" : "border-[#10B981]",
                      )}
                    />
                  ) : null}
                </div>

                <div
                  className={cn(
                    "flex flex-1 items-center justify-between gap-3 rounded-2xl p-3.5",
                    isCurrent
                      ? "border border-[#C7D9FF] bg-[#EEF4FF] shadow-sm"
                      : isFailed
                        ? "border border-[#FECACA] bg-[#FEF2F2]"
                        : "border border-[#E5E7EB] bg-[#F0FDF4]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        stepIcons[step.icon].className,
                      )}
                    >
                      <StepIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={cn("font-bold text-[#0A192F]", isCurrent ? "text-[16px]" : "text-[15px]")}>
                        {step.title}
                      </p>
                      {step.timestamp ? (
                        <p className="mt-0.5 text-[12px] text-[#64748B]">{step.timestamp}</p>
                      ) : step.subtitle ? (
                        <p className="mt-0.5 text-[12px] text-[#64748B]">{step.subtitle}</p>
                      ) : null}
                    </div>
                  </div>

                  {isCurrent ? (
                    <Lock aria-hidden="true" className="size-5 shrink-0 text-[#64748B]" />
                  ) : isFailed ? (
                    <span className="shrink-0 rounded-full bg-[#FEE2E2] px-3 py-1 text-[12px] font-semibold text-[#B91C1C]">
                      Failed
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#DCFCE7] px-3 py-1 text-[12px] font-semibold text-[#15803D]">
                      Completed
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
