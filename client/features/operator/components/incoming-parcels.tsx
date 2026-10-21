"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { operatorOrdersQuerySchema, ordersSearchParams, type OperatorOrdersQuery, type ParcelFilters } from "../types/operator-order.types";
import { useOperatorOrders } from "../hooks/use-operator-orders";
import { IncomingParcelsFilters } from "./incoming-parcels-filters";
import { IncomingParcelsTable } from "./incoming-parcels-table";
import { ParcelRequestState } from "./parcel-request-state";

export function IncomingParcels() {
  const params = useSearchParams();
  const router = useRouter();
  const parsed = operatorOrdersQuerySchema.safeParse(Object.fromEntries(params.entries()));
  if (!parsed.success) return <div role="alert" className="space-y-4"><p>The parcel filters in this link are invalid.</p><Button onClick={() => router.replace("/operator/parcels")}>Reset filters</Button></div>;
  return <IncomingParcelsResults query={parsed.data} navigate={query => router.push(`/operator/parcels?${ordersSearchParams(query)}`, { scroll: false })} />;
}
function IncomingParcelsResults({ query, navigate }: { query: OperatorOrdersQuery; navigate: (query: OperatorOrdersQuery) => void }) {
  const { data, error, isLoading, retry } = useOperatorOrders(query);
  function apply(filters: ParcelFilters) {
    navigate({ page: 1, pageSize: query.pageSize, search: filters.search || undefined,
      status: filters.status || undefined, township: filters.township || undefined, createdDate: filters.createdDate || undefined });
  }
  const returnTo = `/operator/parcels?${ordersSearchParams(query)}`;
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-muted-foreground">Order workspace</p><h1 className="text-3xl font-semibold tracking-tight">Incoming Parcels</h1><p className="mt-2 text-muted-foreground">Browse SME orders and inspect parcel details.</p></div><Button variant="outline" disabled={isLoading} onClick={retry}>Refresh parcels</Button></div>
    <IncomingParcelsFilters key={JSON.stringify(query)} query={query} onApply={apply} onClear={() => navigate({ page: 1, pageSize: 20 })} />
    <ParcelRequestState loading={isLoading} error={error} retry={retry} />
    {data && <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{data.pagination.total.toLocaleString("en-GB")}</span> matching parcels</p><label className="flex items-center gap-2 text-sm">Rows per page<select className="rounded-md border bg-background p-1.5" value={query.pageSize} onChange={event => navigate({ ...query, page: 1, pageSize: Number(event.target.value) })}>{[10, 20, 50, 100, ...(![10, 20, 50, 100].includes(query.pageSize) ? [query.pageSize] : [])].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
      {data.orders.length ? <IncomingParcelsTable orders={data.orders} returnTo={returnTo} /> : <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-medium">No parcels found</h2><p className="mt-2 text-sm text-muted-foreground">Try different filters or return to the first page.</p></div>}
      <nav aria-label="Parcel pagination" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages || 1}</p><div className="flex gap-2"><Button variant="outline" disabled={query.page <= 1} onClick={() => navigate({ ...query, page: query.page - 1 })}>Previous</Button><Button variant="outline" disabled={query.page >= data.pagination.totalPages} onClick={() => navigate({ ...query, page: query.page + 1 })}>Next</Button></div></nav></>}
  </>;
}
