"use client";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperatorOrders } from "../hooks/use-operator-orders";
import { IncomingParcelsTable } from "./incoming-parcels-table";
import { ParcelRequestState } from "./parcel-request-state";
import { ReceiptFeedback } from "./receipt-feedback";

export function OperatorRecentParcels() {
  const { data, error, isLoading, retry } = useOperatorOrders({ page: 1, pageSize: 5 });
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Recent Incoming Parcels</CardTitle><Link href="/operator/parcels" className="text-sm font-medium text-primary hover:underline">View all parcels →</Link></div><CardDescription>Latest SME orders across all statuses.</CardDescription></CardHeader><CardContent className="space-y-4">
    <ReceiptFeedback />
    <ParcelRequestState loading={isLoading} error={error} retry={retry} />
    {data && <><p className="text-sm text-muted-foreground">Total SME orders: <span className="text-lg font-semibold text-foreground tabular-nums">{data.pagination.total.toLocaleString("en-GB")}</span></p>{data.orders.length ? <IncomingParcelsTable orders={data.orders} /> : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No parcels have been submitted yet.</p>}</>}
  </CardContent></Card>;
}
