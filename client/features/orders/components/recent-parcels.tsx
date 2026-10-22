"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Clock3, MapPin, Package, QrCode, Search, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DashboardOrder } from "../schemas/sme-dashboard.schema";
import { OrderStatusBadge, orderStatusMeta } from "./order-status";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

type RecentParcelsProps = {
  orders: DashboardOrder[];
  totalCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  expandedOrderId: string | null;
  onToggle: (orderId: string) => void;
};

export function RecentParcels({
  orders,
  totalCount,
  query,
  onQueryChange,
  expandedOrderId,
  onToggle,
}: RecentParcelsProps) {
  return (
    <section aria-labelledby="recent-orders-title" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 id="recent-orders-title" className="text-heading-2 font-bold tracking-tight text-foreground">
            Recent parcels
          </h2>
          <p className="text-body-md text-muted-foreground">Your latest parcels and their tracking details.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search orders..."
              aria-label="Search parcels by order code, recipient or township"
              className="h-10 pl-9"
            />
          </div>
          {query ? (
            <p className="text-body-sm text-muted-foreground">
              {orders.length} of {totalCount} shown
            </p>
          ) : null}
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <Package aria-hidden="true" className="size-6" />
            </span>
            <p className="text-heading-3 font-semibold text-foreground">
              {totalCount === 0 ? "No parcels yet" : "No matching parcels"}
            </p>
            <p className="max-w-sm text-body-md text-muted-foreground">
              {totalCount === 0
                ? "New parcels will appear here after they’re created."
                : "Try a different order code, recipient or township."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[780px] border-collapse text-left text-body-md"
              aria-labelledby="recent-orders-title"
            >
              <thead className="border-b border-border bg-muted/60 text-caption uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Recipient</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Parcel</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Created</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  return (
                    <OrderRows
                      key={order.id}
                      order={order}
                      expanded={expanded}
                      onToggle={() => onToggle(order.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}

function OrderRows({
  order,
  expanded,
  onToggle,
}: {
  order: DashboardOrder;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="align-middle transition-colors hover:bg-muted/40">
        <th scope="row" className="px-5 py-4 font-semibold text-foreground">{order.orderCode}</th>
        <td className="px-5 py-4">
          <div className="font-medium text-foreground">{order.recipient.name}</div>
          <div className="text-body-sm text-muted-foreground">{order.recipient.township}</div>
        </td>
        <td className="px-5 py-4">
          <div className="text-foreground">{order.parcel.weight} kg</div>
          <div className="text-body-sm text-muted-foreground">
            COD {order.parcel.codAmount} {order.parcel.currency}
          </div>
        </td>
        <td className="px-5 py-4">
          <OrderStatusBadge status={order.status} />
        </td>
        <td className="px-5 py-4 text-muted-foreground">{formatDate(order.createdAt)}</td>
        <td className="px-5 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "Show"} details for ${order.orderCode}`}
          >
            {expanded ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
            {expanded ? "Hide" : "View"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-muted/30 px-5 py-6">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr_auto]">
              <div className="space-y-3">
                <h3 className="text-body-lg font-semibold text-foreground">Order information</h3>
                <div className="grid gap-4 text-body-md sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Phone</span>
                    <p className="mt-1 font-medium text-foreground">{order.recipient.phoneNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Township</span>
                    <p className="mt-1 font-medium text-foreground">{order.recipient.township}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Delivery address</span>
                    <p className="mt-1 flex gap-2 font-medium text-foreground">
                      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {order.recipient.deliveryAddress}
                    </p>
                  </div>
                  {order.parcel.deliveryInstructions && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Instructions</span>
                      <p className="mt-1 text-foreground">{order.parcel.deliveryInstructions}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Operator</span>
                    <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                      <UserRound aria-hidden="true" className="size-4 text-muted-foreground" />
                      {order.operator?.fullName ?? "Not assigned"}
                    </p>
                    {order.operator?.phone && (
                      <p className="mt-1 text-body-sm text-muted-foreground">{order.operator.phone}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivery rider</span>
                    <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                      <Truck aria-hidden="true" className="size-4 text-muted-foreground" />
                      {order.deliveryRider ? "Assigned" : "Not assigned"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-body-lg font-semibold text-foreground">Tracking timeline</h3>
                <ol className="space-y-3">
                  {order.trackingTimeline.map((event, index) => (
                    <li key={`${event.createdAt}-${event.status}-${index}`} className="relative flex gap-3">
                      <span
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                          index === order.trackingTimeline.length - 1 ? "bg-brand-success" : "bg-border"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-body-md font-medium text-foreground">{orderStatusMeta[event.status].label}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-body-sm text-muted-foreground">
                          <Clock3 aria-hidden="true" className="size-3" />
                          {formatTime(event.createdAt)}
                        </p>
                        {event.actor?.fullName && (
                          <p className="mt-0.5 text-body-sm text-muted-foreground">{event.actor.fullName}</p>
                        )}
                        {event.note && <p className="mt-1 text-body-sm break-words text-muted-foreground">{event.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col items-start gap-2 lg:items-center">
                <span className="flex items-center gap-2 text-body-md font-semibold text-foreground">
                  <QrCode aria-hidden="true" className="size-4" />
                  Parcel QR
                </span>
                <Image
                  src={order.qr.imageDataUrl}
                  alt={`QR code for ${order.orderCode}`}
                  width={112}
                  height={112}
                  unoptimized
                  className="size-28 rounded-lg border border-border bg-white p-2"
                />
                <span className="max-w-32 text-center font-mono text-caption break-all text-muted-foreground">
                  {order.qr.identifier}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
