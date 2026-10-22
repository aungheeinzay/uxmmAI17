"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperatorOrderDetails } from "../hooks/use-operator-order-details";
import { formatParcelDate, formatParcelDecimal } from "../format";
import { ParcelStatusBadge, parcelStatusLabel } from "./parcel-status-badge";
import { ParcelRequestState } from "./parcel-request-state";
import { ReceiveParcelDialog } from "./receive-parcel-dialog";
import { ReceiptFeedback } from "./receipt-feedback";
import { warehouseLabels } from "../types/warehouse.types";

export function ParcelDetails({ id, backHref = "/operator/parcels" }: { id: string; backHref?: string }) {
  const { data: order, error, isLoading, retry } = useOperatorOrderDetails(id);
  return <><Link href={backHref} className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline">← Back to Parcels</Link>
    <ReceiptFeedback />
    <Button variant="outline" disabled={isLoading} onClick={retry}>Refresh parcel</Button>
    <ParcelRequestState loading={isLoading} error={error} retry={retry} />
    {order && <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-2 text-sm text-muted-foreground">Parcel details</p><h1 className="break-all font-mono text-2xl font-semibold">{order.orderCode}</h1><p className="mt-2 text-sm text-muted-foreground">Created {formatParcelDate(order.createdAt)} MMT</p></div><ParcelStatusBadge status={order.status} /></div>
      {order.hasIncident && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><span>A Rider reported an incident for this parcel. Reporting does not change the order status.</span><Link href="/operator/incidents" className="font-semibold underline underline-offset-4">Review incidents</Link></div>}
      <ReceiveParcelDialog order={order} />
      {order.warehouseState && <DetailCard title="Warehouse operations" values={[["Warehouse state", warehouseLabels[order.warehouseState]], ["Receipt recorded at", order.receipt ? `${formatParcelDate(order.receipt.receivedAt)} MMT` : "No receipt event recorded"], ["Recorded receiving actor", order.receipt?.receivedBy.fullName ?? "Unavailable"], ["Failure note", order.failureNote ?? "No failure note recorded"]]} />}
      {order.assignment && <DetailCard title="Rider assignment" values={[["Rider", order.assignment.rider.fullName ?? "Name unavailable"], ["Rider phone", order.assignment.rider.phone ?? "Not provided"], ["Assigned", `${formatParcelDate(order.assignment.assignedAt)} MMT`]]} />}
      <div className="grid gap-5 md:grid-cols-2">
        <DetailCard title="Recipient & delivery" values={[["Recipient", order.recipientName], ["Phone", order.phoneNumber], ["Township", order.township], ["Delivery address", order.deliveryAddress], ["Instructions", order.deliveryInstructions || "No instructions provided"]]} />
        <DetailCard title="Parcel information" values={[["Weight", `${formatParcelDecimal(order.parcelWeight)} ${order.parcelWeightUnit}`], ["COD amount", `${formatParcelDecimal(order.codAmount)} ${order.currency}`], ["Operator", (order.operator?.fullName ?? "Not assigned")], ["Last updated", `${formatParcelDate(order.updatedAt)} MMT`]]} />
        <DetailCard title="Seller & sender" values={[["Seller", order.owner.fullName ?? "Name unavailable"], ["Seller ID", order.owner.id], ["Seller phone", order.owner.phone || "Not provided"], ["Sender", order.senderName]]} />
        <Card><CardHeader><CardTitle>Status history</CardTitle></CardHeader><CardContent>{order.statusEvents.length ? <ol>{order.statusEvents.map(event => <li key={event.id} className="tracking-event" data-status={event.status}><p className="text-sm font-medium">{parcelStatusLabel(event.previousStatus)} → {parcelStatusLabel(event.status)}</p><p className="mt-1 text-xs text-muted-foreground"><time dateTime={event.createdAt}>{formatParcelDate(event.createdAt)} MMT</time> · {event.actor.fullName ?? "Name unavailable"}</p>{event.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.note}</p>}</li>)}</ol> : <p className="text-sm text-muted-foreground">No status changes recorded.</p>}</CardContent></Card>
      </div></>}
  </>;
}
function DetailCard({ title, values }: { title: string; values: [string, string][] }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><dl className="space-y-4">{values.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value}</dd></div>)}</dl></CardContent></Card>;
}
