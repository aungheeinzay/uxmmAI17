"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ParcelStatusBadge, parcelStatusLabel } from "@/features/operator/components/parcel-status-badge";
import { formatParcelDate, formatParcelDecimal } from "@/features/operator/format";
import { getMyAssignment } from "../api/deliveries.api";
import { useDeliveryResource } from "../hooks/use-deliveries";
import { DeliveryActions } from "./delivery-actions";
import { DeliveryFeedback, DeliveryRequestState } from "./delivery-shared";
export function RiderDeliveryDetails({ id }: { id: string }) {
  const query = useDeliveryResource("RIDER", id, getMyAssignment);
  const item = query.data;
  return <><Link href="/rider" className="text-sm underline">Back to my deliveries</Link><DeliveryFeedback />
    <DeliveryRequestState loading={query.isLoading} error={query.error} retry={query.retry} />
    {item && <><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="break-all font-mono text-2xl font-semibold">{item.order.orderCode}</h1><ParcelStatusBadge status={item.order.status} /><Button variant="outline" onClick={query.retry}>Refresh delivery</Button></div>
      <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Recipient & delivery</h2><p>{item.order.recipientName}</p><p className="break-words">Phone: {item.order.phoneNumber}</p><p>{item.order.township}</p><p className="whitespace-pre-wrap break-words">{item.order.deliveryAddress}</p><p className="whitespace-pre-wrap break-words">Instructions: {item.order.deliveryInstructions ?? "None provided"}</p><p>COD: {formatParcelDecimal(item.order.codAmount)} {item.order.currency}</p><p className="text-sm text-muted-foreground">Assigned {formatParcelDate(item.assignedAt)} MMT</p></section>
      <DeliveryActions assignment={item} />
      <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="font-semibold">Delivery history</h2>{!item.order.statusEvents.length ? <p>No status changes recorded.</p> : <ol className="space-y-4">{item.order.statusEvents.map(event => <li key={event.id} className="border-l-2 pl-4"><p>{parcelStatusLabel(event.previousStatus)} → {parcelStatusLabel(event.status)}</p><p className="text-xs text-muted-foreground">{formatParcelDate(event.createdAt)} MMT · {event.actor.fullName ?? "Name unavailable"}</p>{event.note && <p className="whitespace-pre-wrap break-words text-sm">{event.note}</p>}</li>)}</ol>}</section>
    </>}
  </>;
}
