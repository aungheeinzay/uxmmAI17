"use client";

import { Package, PackageOpen, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ListedOrder, OrderStatus } from "../schemas/order-list.schema";
import { OrderStatusBadge } from "./order-status";
import { ParcelStatusFilter } from "./parcel-status-filter";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatMoney(amount: string, currency: string) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return `${amount} ${currency}`;
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(numeric);
}

type ParcelListTableProps = {
  orders: ListedOrder[];
  isRefreshing: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  status: OrderStatus | null;
  onStatusChange: (status: OrderStatus | null) => void;
  emptyTitle: string;
  emptyDescription: string;
};

export function ParcelListTable({
  orders,
  isRefreshing,
  search,
  onSearchChange,
  status,
  onStatusChange,
  emptyTitle,
  emptyDescription,
}: ParcelListTableProps) {
  return (
    <div className="space-y-4" id="parcel-list-panel" role="tabpanel" aria-labelledby="parcel-list-panel-label">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="parcel-list-panel-label" className="sr-only">
          Parcel list
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search order code or recipient"
              aria-label="Search parcels by order code or recipient"
              className="h-10 pl-9"
            />
          </div>
          <ParcelStatusFilter value={status} onChange={onStatusChange} />
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <Package aria-hidden="true" className="size-6" />
            </span>
            <p className="text-heading-3 font-semibold text-foreground">{emptyTitle}</p>
            <p className="max-w-sm text-body-md text-muted-foreground">{emptyDescription}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className={`overflow-x-auto transition-opacity ${isRefreshing ? "opacity-60" : ""}`} aria-busy={isRefreshing}>
            <table className="w-full min-w-[880px] border-collapse text-left text-body-md">
              <thead className="border-b border-border bg-muted/60 text-caption uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Recipient</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Township</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Parcel</th>
                  <th scope="col" className="px-5 py-3 font-semibold">COD</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="align-middle transition-colors hover:bg-muted/40">
                    <th scope="row" className="px-5 py-4 font-semibold text-foreground">{order.orderCode}</th>
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{order.recipientName}</div>
                      <div className="text-body-sm text-muted-foreground">{order.phoneNumber}</div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{order.township}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <PackageOpen aria-hidden="true" className="size-4 text-muted-foreground" />
                        {order.parcelWeight} {order.parcelWeightUnit}
                      </div>
                      <div className="text-body-sm text-muted-foreground">{order.senderName}</div>
                    </td>
                    <td className="px-5 py-4 text-foreground">{formatMoney(order.codAmount, order.currency)}</td>
                    <td className="px-5 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
