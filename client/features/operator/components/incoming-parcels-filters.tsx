"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orderStatuses, parcelFilterSchema, type OperatorOrdersQuery, type ParcelFilters } from "../types/operator-order.types";
import { parcelStatusLabel } from "./parcel-status-badge";

export function IncomingParcelsFilters({ query, onApply, onClear, receivedOnly = false }: {
  receivedOnly?: boolean; query: OperatorOrdersQuery; onApply: (filters: ParcelFilters) => void; onClear: () => void;
}) {
  const form = useForm<ParcelFilters>({ resolver: zodResolver(parcelFilterSchema), defaultValues: {
    search: query.search ?? "", status: query.status ?? "", township: query.township ?? "", createdDate: query.createdDate ?? "",
  } });
  return <form onSubmit={form.handleSubmit(onApply)} className="space-y-3 rounded-xl border bg-card p-4" aria-label="Parcel filters">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="parcel-search">Search parcels</Label><Input id="parcel-search" placeholder="Order code or recipient" maxLength={120} {...form.register("search")} /></div>
      <div className="space-y-2"><Label htmlFor="parcel-status">Status</Label><select disabled={receivedOnly} id="parcel-status" className="h-9 w-full rounded-lg border bg-background px-3 text-sm focus-visible:outline-2" {...form.register("status")}><option value="">All statuses</option>{orderStatuses.map(status => <option key={status} value={status}>{parcelStatusLabel(status)}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="parcel-township">Township</Label><Input id="parcel-township" placeholder="Exact township" maxLength={120} {...form.register("township")} /></div>
      <div className="space-y-2"><Label htmlFor="parcel-date">Created date (UTC)</Label><Input id="parcel-date" type="date" {...form.register("createdDate")} /></div>
    </div>
    {Object.keys(form.formState.errors).length > 0 && <p role="alert" className="text-sm text-destructive">Enter a valid date and use no more than 120 characters per search field.</p>}
    <div className="flex flex-wrap items-center gap-2"><Button type="submit">Apply filters</Button><Button type="button" variant="ghost" onClick={onClear}>Clear filters</Button><p className="ml-auto text-xs text-muted-foreground">{receivedOnly ? "Received parcels only (PICKED_UP)" : "All statuses shown unless filtered"}</p></div>
  </form>;
}
