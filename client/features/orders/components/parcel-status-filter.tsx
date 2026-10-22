"use client";

import { ChevronDown } from "lucide-react";
import type { OrderStatus } from "../schemas/order-list.schema";
import { orderStatusMeta } from "./order-status";

// Every status the parcel list can be filtered by, in delivery order.
const filterableStatuses = [
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[];

type ParcelStatusFilterProps = {
  value: OrderStatus | null;
  onChange: (status: OrderStatus | null) => void;
};

export function ParcelStatusFilter({ value, onChange }: ParcelStatusFilterProps) {
  return (
    <div className="relative w-full sm:w-48">
      <label htmlFor="parcel-status-filter" className="sr-only">
        Filter parcels by status
      </label>
      <select
        id="parcel-status-filter"
        value={value ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? null : (next as OrderStatus));
        }}
        className="h-10 w-full appearance-none rounded-lg border border-input bg-white py-2 pr-9 pl-3 text-body-md text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
      >
        <option value="">All statuses</option>
        {filterableStatuses.map((status) => (
          <option key={status} value={status}>
            {orderStatusMeta[status].label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
