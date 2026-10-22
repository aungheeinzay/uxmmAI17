"use client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useWarehouseOverview } from "../hooks/use-warehouse";
import { ParcelRequestState } from "./parcel-request-state";
export function WarehouseOverview() {
  const query = useWarehouseOverview();
  const data = query.data;
  return <section aria-label="Warehouse overview" className="space-y-4"><div><h2 className="text-lg font-semibold">Warehouse overview</h2><p className="text-xs text-muted-foreground">All-time scope · current status counts across the delivery operation. Overview is independent of table filters.</p></div>
    <ParcelRequestState loading={query.isLoading} error={query.error} retry={query.retry} loadingMessage={query.isRefetching ? "Refreshing warehouse counts…" : "Loading warehouse counts…"} />
    {data && <><p className="text-sm font-medium">Received awaiting dispatch: {data.receivedAwaitingDispatch.toLocaleString("en-GB")}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ["Unassigned", data.unassigned, "PICKED_UP · no Rider assignment"],
        ["Assigned / awaiting dispatch", data.assignedAwaitingDispatch, "PICKED_UP · Rider assigned"],
        ["Dispatched", data.dispatched, "In transit / out for delivery · tracking only"],
        ["Delivery exceptions", data.exceptions, "FAILED · tracking only"],
        ["Completed deliveries", data.completed, "DELIVERED · historical total"],
      ].map(([label, count, caption]) => <Card key={label}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{Number(count).toLocaleString("en-GB")}</p><p className="mt-2 text-xs text-muted-foreground">{caption}</p></CardContent></Card>)}</div>
      <p className="text-xs text-muted-foreground">Only unassigned and assigned PICKED_UP parcels count as received inventory awaiting dispatch. Tracking groups do not prove physical warehouse location.</p></>}
  </section>;
}
