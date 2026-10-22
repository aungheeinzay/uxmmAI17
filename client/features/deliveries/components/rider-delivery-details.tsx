"use client";

import Link from "next/link";
import { Banknote, ChevronLeft, MapPin, Package, Phone, RefreshCw, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParcelStatusBadge, parcelStatusLabel } from "@/features/operator/components/parcel-status-badge";
import { formatParcelDate, formatParcelDecimal } from "@/features/operator/format";
import { getMyAssignment } from "../api/deliveries.api";
import { useDeliveryResource } from "../hooks/use-deliveries";
import { DeliveryActions } from "./delivery-actions";
import { DeliveryFeedback, DeliveryRequestState } from "./delivery-shared";
import { ReportIncidentButton } from "@/features/incidents/components/report-incident-button";
import { IncidentFeedback } from "@/features/incidents/components/incident-shared";

export function RiderDeliveryDetails({ id }: { id: string }) {
  const query = useDeliveryResource("RIDER", id, getMyAssignment);
  const item = query.data;
  return (
    <div className="space-y-4">
      <Link href="/rider" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden="true" className="size-4" />Back to my deliveries
      </Link>
      <DeliveryFeedback />
      <IncidentFeedback />
      <DeliveryRequestState loading={query.isLoading} error={query.error} retry={query.retry} />
      {item && (
        <>
          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parcel</p>
                <h1 className="mt-1 break-all font-mono text-xl font-bold">{item.order.orderCode}</h1>
              </div>
              <ParcelStatusBadge status={item.order.status} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">Assigned {formatParcelDate(item.assignedAt)} MMT</p>
              <Button variant="outline" size="sm" onClick={query.retry} className="min-h-9"><RefreshCw aria-hidden="true" />Refresh delivery</Button>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Recipient & delivery</h2>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"><Package aria-hidden="true" className="size-5" /></span>
              <div className="min-w-0">
                <p className="font-medium">{item.order.recipientName}</p>
                <a href={`tel:${item.order.phoneNumber}`} className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline">
                  <Phone aria-hidden="true" className="size-3.5" />Phone: {item.order.phoneNumber}
                </a>
              </div>
            </div>
            <p className="flex items-start gap-2 text-sm"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{item.order.deliveryAddress}<br /><span className="text-muted-foreground">{item.order.township}</span></span></p>
            {item.order.deliveryInstructions && <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm"><StickyNote aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 whitespace-pre-wrap break-words">{item.order.deliveryInstructions}</span></p>}
            <p className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Banknote aria-hidden="true" className="size-4" />Cash on delivery</span><span className="font-semibold">COD: {formatParcelDecimal(item.order.codAmount)} {item.order.currency}</span></p>
          </section>

          <DeliveryActions assignment={item} />

          <ReportIncidentButton assignment={item} />

          <section className="space-y-4 rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Delivery history</h2>
            {!item.order.statusEvents.length ? <p className="text-sm text-muted-foreground">No status changes recorded.</p> : (
              <ol className="relative space-y-5 border-l-2 border-border pl-5">
                {item.order.statusEvents.map(event => (
                  <li key={event.id} className="relative" data-status={event.status}>
                    <span aria-hidden="true" className={`absolute -left-[1.7rem] top-1 size-3 rounded-full ring-4 ring-card ${event.status === "FAILED" ? "bg-destructive" : event.status === "DELIVERED" ? "bg-emerald-500" : "bg-primary"}`} />
                    <p className="text-sm font-medium">{parcelStatusLabel(event.previousStatus)} → {parcelStatusLabel(event.status)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatParcelDate(event.createdAt)} MMT · {event.actor.fullName ?? "Name unavailable"}</p>
                    {event.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{event.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
