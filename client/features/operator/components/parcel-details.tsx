"use client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperatorOrderDetails } from "../hooks/use-operator-order-details";
import { formatParcelDate, formatParcelDecimal } from "../format";
import { ParcelStatusBadge, parcelStatusLabel } from "./parcel-status-badge";
import { ParcelRequestState } from "./parcel-request-state";

export function ParcelDetails({ id, backHref = "/operator/parcels" }: { id: string; backHref?: string }) {
  const { data: order, error, isLoading, retry } = useOperatorOrderDetails(id);
  return <><Link href={backHref} className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">← Back to Parcels</Link>
    <ParcelRequestState loading={isLoading} error={error} retry={retry} />
    {order && <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-2 text-sm text-muted-foreground">Parcel details</p><h1 className="break-all font-mono text-2xl font-semibold">{order.orderCode}</h1><p className="mt-2 text-sm text-muted-foreground">Created {formatParcelDate(order.createdAt)} MMT</p></div><ParcelStatusBadge status={order.status} /></div>
      <div className="grid gap-5 md:grid-cols-2">
        <DetailCard title="Recipient & delivery" values={[["Recipient", order.recipientName], ["Phone", order.phoneNumber], ["Township", order.township], ["Delivery address", order.deliveryAddress], ["Instructions", order.deliveryInstructions || "No instructions provided"]]} />
        <DetailCard title="Parcel information" values={[["Weight", `${formatParcelDecimal(order.parcelWeight)} ${order.parcelWeightUnit}`], ["COD amount", `${formatParcelDecimal(order.codAmount)} ${order.currency}`], ["Operator", (order.operator?.fullName ?? "Not assigned")], ["Last updated", `${formatParcelDate(order.updatedAt)} MMT`]]} />
        <DetailCard title="Seller & sender" values={[["Seller", order.owner.fullName ?? "Name unavailable"], ["Seller ID", order.owner.id], ["Seller phone", order.owner.phone || "Not provided"], ["Sender", order.senderName]]} />
        <Card><CardHeader><CardTitle>Status history</CardTitle></CardHeader><CardContent>{order.statusEvents.length ? <ol className="space-y-5">{order.statusEvents.map(event => <li key={event.id} className="border-l-2 border-border pl-4"><p className="text-sm font-medium">{parcelStatusLabel(event.previousStatus)} → {parcelStatusLabel(event.status)}</p><p className="mt-1 text-xs text-muted-foreground"><time dateTime={event.createdAt}>{formatParcelDate(event.createdAt)} MMT</time> · {event.actor.fullName ?? "Name unavailable"}</p>{event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.note}</p>}</li>)}</ol> : <p className="text-sm text-muted-foreground">No status changes recorded.</p>}</CardContent></Card>
      </div></>}
  </>;
}
function DetailCard({ title, values }: { title: string; values: [string, string][] }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><dl className="space-y-4">{values.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd></div>)}</dl></CardContent></Card>;
}
