"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { warehouseFilterSchema, warehouseLabels, warehouseStates, type WarehouseQuery, type WarehouseFilters } from "../types/warehouse.types";
export function WarehouseFilters({ query, apply, clear }: { query: WarehouseQuery; apply: (value: WarehouseFilters) => void; clear: () => void }) {
  const form = useForm<WarehouseFilters>({ resolver: zodResolver(warehouseFilterSchema), defaultValues: { search: query.search ?? "", township: query.township ?? "", warehouseState: query.warehouseState ?? "", createdDate: query.createdDate ?? "" } });
  return <form aria-label="Warehouse filters" onSubmit={form.handleSubmit(apply)} className="space-y-3 rounded-xl border bg-card p-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <div className="space-y-2"><Label htmlFor="warehouse-search">Search parcels</Label><Input id="warehouse-search" maxLength={120} placeholder="Order code or recipient" {...form.register("search")} /></div>
    <div className="space-y-2"><Label htmlFor="warehouse-state">Warehouse state</Label><select id="warehouse-state" className="h-9 w-full rounded-lg border bg-background px-3 text-sm" {...form.register("warehouseState")}><option value="">All warehouse groups</option>{warehouseStates.map(state => <option key={state} value={state}>{warehouseLabels[state]}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="warehouse-township">Township</Label><Input id="warehouse-township" maxLength={120} placeholder="Exact township" {...form.register("township")} /></div>
    <div className="space-y-2"><Label htmlFor="warehouse-date">Created date (UTC)</Label><Input id="warehouse-date" type="date" {...form.register("createdDate")} /></div>
  </div>{Object.keys(form.formState.errors).length > 0 && <p role="alert">Use valid filters: at most 120 characters per search field and a valid date.</p>}<div className="flex gap-2"><Button type="submit">Apply filters</Button><Button type="button" variant="ghost" onClick={clear}>Clear filters</Button></div></form>;
}
