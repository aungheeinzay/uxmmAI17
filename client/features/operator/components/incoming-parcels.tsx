"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { operatorOrdersQuerySchema, ordersSearchParams, type OperatorOrdersQuery, type ParcelFilters } from "../types/operator-order.types";
import { useOperatorOrders } from "../hooks/use-operator-orders";
import { IncomingParcelsFilters } from "./incoming-parcels-filters";
import { IncomingParcelsTable } from "./incoming-parcels-table";
import { ParcelRequestState } from "./parcel-request-state";
import { ReceiptFeedback } from "./receipt-feedback";

export function IncomingParcels({ warehouse = false }: { warehouse?: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const parsed = operatorOrdersQuerySchema.safeParse(Object.fromEntries(params.entries()));
  const route = warehouse ? "/operator/warehouse" : "/operator/parcels";
  if (!parsed.success) return <div role="alert" className="space-y-4"><p>The parcel filters in this link are invalid.</p><Button onClick={() => router.replace(route)}>Reset filters</Button></div>;
  return <IncomingParcelsResults warehouse={warehouse} query={warehouse ? { ...parsed.data, status: "PICKED_UP" } : parsed.data} navigate={query => router.push(`${route}?${ordersSearchParams(query)}`, { scroll: false })} />;
}
function IncomingParcelsResults({ query, navigate, warehouse }: { warehouse: boolean; query: OperatorOrdersQuery; navigate: (query: OperatorOrdersQuery) => void }) {
  const { data, error, isLoading, isRefetching, retry } = useOperatorOrders(query);
  function apply(filters: ParcelFilters) {
    navigate({ page: 1, pageSize: query.pageSize, search: filters.search || undefined,
      status: warehouse ? "PICKED_UP" : filters.status || undefined, township: filters.township || undefined, createdDate: filters.createdDate || undefined });
  }
  const returnTo = `${warehouse ? "/operator/warehouse" : "/operator/parcels"}?${ordersSearchParams(query)}`;
  return <>
    <ReceiptFeedback />
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-muted-foreground">Order workspace</p><h1 className="text-3xl font-semibold tracking-tight">{warehouse ? "Received Parcels" : "Incoming Parcels"}</h1><p className="mt-2 text-muted-foreground">{warehouse ? "Parcels received into delivery operations (PICKED_UP). Assignment information is unavailable." : "Browse SME orders and inspect parcel details."}</p></div><Button variant="outline" disabled={isLoading} onClick={retry}>Refresh parcels</Button></div>
    <IncomingParcelsFilters receivedOnly={warehouse} key={JSON.stringify(query)} query={query} onApply={apply} onClear={() => navigate({ page: 1, pageSize: 20 })} />
    <ParcelRequestState loading={isLoading} error={error} retry={retry} />
    {isRefetching && <p role="status" className="text-sm text-muted-foreground">Updating parcels…</p>}
    {data && <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{data.pagination.total.toLocaleString("en-GB")}</span> matching parcels</p><PageSizeSelect value={query.pageSize} onChange={value => navigate({ ...query, page: 1, pageSize: value })} /></div>
      {data.orders.length ? <IncomingParcelsTable warehouse={warehouse} orders={data.orders} returnTo={returnTo} /> : <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-medium">No parcels found</h2><p className="mt-2 text-sm text-muted-foreground">Try different filters or return to the first page.</p></div>}
      <nav aria-label="Parcel pagination" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.totalPages || 1}</p><div className="flex gap-2"><Button variant="outline" disabled={query.page <= 1} onClick={() => navigate({ ...query, page: query.page - 1 })}>Previous</Button><Button variant="outline" disabled={query.page >= data.pagination.totalPages} onClick={() => navigate({ ...query, page: query.page + 1 })}>Next</Button></div></nav></>}
  </>;
}
