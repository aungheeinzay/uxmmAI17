"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useOperatorOrders } from "@/features/operator/hooks/use-operator-orders";
import { ParcelStatusBadge } from "@/features/operator/components/parcel-status-badge";
import { AssignParcelDialog } from "./assign-parcel-dialog";
import { DeliveryFeedback, DeliveryRequestState, DeliveryPagination } from "./delivery-shared";
import { useOperatorOrderDetails } from "@/features/operator/hooks/use-operator-order-details";
export function OperatorAssignments({ selectedOrderId, backHref }: { selectedOrderId?: string; backHref?: string }) {
  return selectedOrderId ? <SelectedParcelAssignment id={selectedOrderId} backHref={backHref} /> : <UnassignedParcels />;
}
function SelectedParcelAssignment({ id, backHref }: { id: string; backHref?: string }) {
  const parcel = useOperatorOrderDetails(id);
  const order = parcel.data;
  return <><h1 className="text-3xl font-semibold">Assign selected parcel</h1><Link className="inline-block text-sm underline" href={backHref ?? "/operator/warehouse"}>Back to warehouse</Link>
    <DeliveryFeedback /><DeliveryRequestState loading={parcel.isLoading} error={parcel.error} retry={parcel.retry} />
    {order && <article className="space-y-4 rounded-xl border bg-card p-5"><h2 className="font-mono font-semibold">{order.orderCode}</h2><p>{order.recipientName} · {order.township}</p><ParcelStatusBadge status={order.status} />
      {order.status === "PICKED_UP" && !order.assignment ? <AssignParcelDialog order={order} /> : <p>{order.assignment ? `Rider assigned: ${order.assignment.rider.fullName ?? "Name unavailable"}.` : "This parcel is not eligible for assignment in its current status."}</p>}
      <Link href={`/operator/parcels/${order.id}?returnTo=${encodeURIComponent(backHref ?? "/operator/warehouse")}`} className="block text-sm underline">View parcel details</Link></article>}
    <Link className="inline-block text-sm underline" href="/operator/assignments">Browse all unassigned parcels</Link></>;
}
function UnassignedParcels() {
  const [page, setPage] = useState(1);
  const parcels = useOperatorOrders({ page, pageSize: 20, status: "PICKED_UP", unassigned: "true" });
  return <><div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-semibold">Rider Assignment</h1><p className="mt-2 text-muted-foreground">Received parcels with no Rider assignment.</p></div><Button variant="outline" onClick={parcels.retry} disabled={parcels.isLoading}>Refresh parcels</Button></div>
    <DeliveryFeedback /><DeliveryRequestState loading={parcels.isLoading} error={parcels.error} retry={parcels.retry} />
    {parcels.data && <>{!parcels.data.orders.length && <p className="rounded-lg border border-dashed p-8">No received parcels awaiting assignment.</p>}
      <div className="space-y-3">{parcels.data.orders.map(order => <article key={order.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"><div><h2 className="font-mono font-semibold">{order.orderCode}</h2><p>{order.recipientName} · {order.township}</p><p className="text-sm text-muted-foreground">{order.deliveryAddress}</p><ParcelStatusBadge status={order.status} /></div><div className="flex flex-wrap items-center gap-3"><Link href={`/operator/parcels/${order.id}`} className="text-sm underline">View details</Link>{order.status === "PICKED_UP" && <AssignParcelDialog order={order} />}</div></article>)}</div>
      <DeliveryPagination {...parcels.data.pagination} onPage={setPage} /></>}
    <Link href="/operator/monitoring" className="inline-block text-sm underline">View assignments and delivery progress</Link>
  </>;
}
