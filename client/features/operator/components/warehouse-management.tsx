"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { warehouseQuerySchema, warehouseSearchParams, type WarehouseQuery, type WarehouseFilters as WarehouseFilterValues } from "../types/warehouse.types";
import { useWarehouseParcels } from "../hooks/use-warehouse";
import { WarehouseOverview } from "./warehouse-overview";
import { WarehouseFilters } from "./warehouse-filters";
import { IncomingParcelsTable } from "./incoming-parcels-table";
import { ParcelRequestState } from "./parcel-request-state";
import { DeliveryPagination } from "@/features/deliveries/components/delivery-shared";
export function WarehouseManagement() {
  const params = useSearchParams();
  const router = useRouter();
  const parsed = warehouseQuerySchema.safeParse(Object.fromEntries(params.entries()));
  if (!parsed.success) return <div role="alert" className="space-y-4"><p>The warehouse filters in this link are invalid.</p><Button onClick={() => router.replace("/operator/warehouse")}>Reset filters</Button></div>;
  return <WarehouseResults query={parsed.data} navigate={query => router.push(`/operator/warehouse?${warehouseSearchParams(query)}`, { scroll: false })} />;
}
function WarehouseResults({ query, navigate }: { query: WarehouseQuery; navigate: (query: WarehouseQuery) => void }) {
  const parcels = useWarehouseParcels(query);
  const returnTo = `/operator/warehouse?${warehouseSearchParams(query)}`;
  function apply(filters: WarehouseFilterValues) { navigate({ page: 1, pageSize: query.pageSize, search: filters.search || undefined, township: filters.township || undefined, createdDate: filters.createdDate || undefined, warehouseState: filters.warehouseState || undefined }); }
  function refresh() { window.dispatchEvent(new Event("operator-parcels-changed")); }
  const filtered = !!(query.search || query.township || query.createdDate || query.warehouseState);
  return <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-sm text-muted-foreground">Operations workspace</p><h1 className="text-3xl font-semibold tracking-tight">Warehouse Management</h1><p className="mt-2 text-muted-foreground">Received inventory awaiting dispatch and delivery tracking groups.</p></div><Button variant="outline" onClick={refresh} disabled={parcels.isLoading}>Refresh warehouse</Button></div>
    <WarehouseOverview />
    <section className="space-y-4" aria-label="Warehouse parcels"><div><h2 className="text-lg font-semibold">Warehouse parcels & delivery tracking</h2><p className="text-sm text-muted-foreground">Incoming CREATED and CANCELLED orders are excluded. Dates filter order creation, not receipt or dispatch.</p></div>
      <WarehouseFilters key={JSON.stringify(query)} query={query} apply={apply} clear={() => navigate({ page: 1, pageSize: 20 })} />
      <ParcelRequestState loading={parcels.isLoading} error={parcels.error} retry={parcels.retry} loadingMessage={parcels.isRefetching ? "Refreshing warehouse parcels…" : "Loading warehouse parcels…"} />
      {parcels.isRefetching && <p role="status" className="text-sm text-muted-foreground">Updating warehouse parcels…</p>}
      {parcels.data && <><div className="flex justify-end"><PageSizeSelect value={query.pageSize} onChange={value => navigate({ ...query, page: 1, pageSize: value })} /></div>
        {parcels.data.orders.length ? <IncomingParcelsTable warehouse orders={parcels.data.orders} returnTo={returnTo} /> : <div className="rounded-xl border border-dashed p-10 text-center"><h3 className="font-medium">{filtered ? "No parcels match these filters" : "No warehouse parcels found"}</h3><p className="mt-2 text-sm text-muted-foreground">{filtered ? "Try different filters or return to the first page." : "Receive an incoming parcel to start warehouse operations."}</p></div>}
        <DeliveryPagination {...parcels.data.pagination} onPage={page => navigate({ ...query, page })} /></>}
    </section>
  </>;
}
