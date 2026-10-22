"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ParcelStatusBadge } from "@/features/operator/components/parcel-status-badge";
import { formatParcelDate, formatParcelDecimal } from "@/features/operator/format";
import { getAssignments, getMyAssignments } from "../api/deliveries.api";
import { useDeliveryResource } from "../hooks/use-deliveries";
import type { DeliveryQuery } from "../types/delivery.types";
import { DeliveryFeedback, DeliveryRequestState, DeliveryPagination } from "./delivery-shared";
const operatorLoad = (key: string) => getAssignments(JSON.parse(key) as DeliveryQuery);
const riderLoad = (key: string) => getMyAssignments(JSON.parse(key) as DeliveryQuery);
export function AssignmentList({ operator = false }: { operator?: boolean }) {
  const [page, setPage] = useState(1);
  const query = useDeliveryResource(operator ? "OPERATOR" : "RIDER", JSON.stringify({ page, pageSize: 20 }), operator ? operatorLoad : riderLoad);
  return <><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">{operator ? "Delivery Monitoring" : "My Deliveries"}</h1><p className="mt-2 text-muted-foreground">{operator ? "Assigned Riders, current parcel status and delivery history." : "Parcels assigned to you, including completed deliveries."}</p></div><Button variant="outline" disabled={query.isLoading} onClick={query.retry}>Refresh deliveries</Button></div>
    {operator && <Link href="/operator/assignments" className="inline-block text-sm underline">Assign a received parcel</Link>}
    <DeliveryFeedback /><DeliveryRequestState loading={query.isLoading} error={query.error} retry={query.retry} />
    {query.data && <>{!query.data.assignments.length && <p className="rounded-lg border border-dashed p-8">No assigned deliveries found.</p>}
      <div className="grid gap-4 sm:grid-cols-2">{query.data.assignments.map(item => <article key={item.id} className="space-y-3 rounded-2xl border bg-card p-5 shadow-[0_2px_8px_rgba(27,47,90,0.025)]"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-mono font-semibold">{item.order.orderCode}</h2><ParcelStatusBadge status={item.order.status} /></div>{operator && item.order.hasIncident && <Link href="/operator/incidents" className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Incident reported — review</Link>}<p>{item.order.recipientName} · {item.order.township}</p><p className="whitespace-pre-wrap text-sm">{item.order.deliveryAddress}</p><p className="text-sm">COD: {formatParcelDecimal(item.order.codAmount)} {item.order.currency}</p>{operator && <p className="text-sm">Rider: {item.rider.fullName ?? "Name unavailable"}</p>}<p className="text-xs text-muted-foreground">Assigned {formatParcelDate(item.assignedAt)} MMT</p><Link href={operator ? `/operator/parcels/${item.orderId}?returnTo=${encodeURIComponent("/operator/monitoring")}` : `/rider/assignments/${item.id}`} className="inline-block text-sm font-medium underline">View delivery details and history</Link></article>)}</div>
      <DeliveryPagination {...query.data.pagination} onPage={setPage} /></>}
  </>;
}
