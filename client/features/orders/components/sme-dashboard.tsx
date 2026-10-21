"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Package,
  QrCode,
  RefreshCw,
  Truck,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSmeDashboard } from "../hooks/use-sme-dashboard";
import type { DashboardOrderStatus } from "../schemas/sme-dashboard.schema";

const statuses: { key: DashboardOrderStatus; label: string; color: string }[] = [
  { key: "CREATED", label: "Created", color: "bg-sky-500" },
  { key: "PICKED_UP", label: "Picked up", color: "bg-cyan-600" },
  { key: "IN_TRANSIT", label: "In transit", color: "bg-indigo-500" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery", color: "bg-amber-500" },
  { key: "DELIVERED", label: "Delivered", color: "bg-emerald-600" },
  { key: "FAILED", label: "Failed", color: "bg-rose-600" },
  { key: "CANCELLED", label: "Cancelled", color: "bg-zinc-500" },
];

const statusStyle: Record<DashboardOrderStatus, string> = {
  CREATED: "border-sky-200 bg-sky-50 text-sky-800",
  PICKED_UP: "border-cyan-200 bg-cyan-50 text-cyan-800",
  IN_TRANSIT: "border-indigo-200 bg-indigo-50 text-indigo-800",
  OUT_FOR_DELIVERY: "border-amber-200 bg-amber-50 text-amber-900",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-800",
  CANCELLED: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

function formatStatus(status: DashboardOrderStatus) {
  return statuses.find((item) => item.key === status)?.label ?? status;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", ...options }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function StatusPill({ status }: { status: DashboardOrderStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle[status]}`}>{formatStatus(status)}</span>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard" role="status">
      <div className="h-10 w-56 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />)}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
      <span className="sr-only">Loading parcel dashboard</span>
    </div>
  );
}

export function SmeDashboard() {
  const { dashboard, isLoading, hasError, refresh } = useSmeDashboard();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  if (isLoading && !dashboard) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-sm font-medium text-emerald-700">SME workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Parcel overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">A current view of your shipments and their progress.</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading} aria-label="Refresh dashboard">
          <RefreshCw aria-hidden="true" className={isLoading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </header>

      {hasError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>We couldn’t load your parcel summary. Check your connection and try again.</span>
            <Button variant="outline" size="sm" onClick={refresh}>Try again</Button>
          </AlertDescription>
        </Alert>
      )}

      {dashboard && (
        <>
          <section aria-label="Parcel totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="col-span-2 border-emerald-200 bg-emerald-50/70 sm:col-span-1">
              <CardContent className="flex h-full min-h-28 flex-col justify-between p-4">
                <div className="flex items-center justify-between text-emerald-900">
                  <span className="text-sm font-medium">Total parcels</span>
                  <Package aria-hidden="true" className="size-4" />
                </div>
                <span className="text-3xl font-semibold tabular-nums text-emerald-950">{dashboard.totalParcels}</span>
              </CardContent>
            </Card>
            {statuses.slice(0, 3).map(({ key, label, color }) => (
              <Card key={key} className="min-w-0">
                <CardContent className="flex h-full min-h-28 flex-col justify-between p-4">
                  <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><span className={`size-2 rounded-full ${color}`} />{label}</span>
                  <span className="text-3xl font-semibold tabular-nums">{dashboard.statusCounts[key]}</span>
                </CardContent>
              </Card>
            ))}
          </section>

          <section aria-label="Parcel status counts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statuses.slice(3).map(({ key, label, color }) => (
              <Card key={key} className="min-w-0">
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><span className={`size-2 shrink-0 rounded-full ${color}`} />{label}</span>
                  <span className="text-xl font-semibold tabular-nums">{dashboard.statusCounts[key]}</span>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="space-y-3" aria-labelledby="delivery-overview-title">
            <div>
              <h2 id="delivery-overview-title" className="text-lg font-semibold">Delivery overview</h2>
              <p className="text-sm text-muted-foreground">Shipments grouped by when the parcel was created.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {([
                ["This week", dashboard.deliveryOverview.thisWeek, <CalendarDays key="week" aria-hidden="true" className="size-4" />],
                ["This month", dashboard.deliveryOverview.thisMonth, <Truck key="month" aria-hidden="true" className="size-4" />],
              ] as const).map(([label, period, icon]) => (
                <Card key={label}>
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle>{label}</CardTitle>
                      <CardDescription>{formatDate(period.startsAt)} – {formatDate(period.endsAt)}</CardDescription>
                    </div>
                    <span className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</span>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><p className="text-sm text-muted-foreground">Total shipments</p><p className="mt-1 text-2xl font-semibold tabular-nums">{period.totalShipments}</p></div>
                      <div><p className="text-sm text-muted-foreground">Delivered</p><p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums"><Check aria-hidden="true" className="size-5 text-emerald-700" />{period.totalDelivered}</p></div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">Success rate</span><span className="font-semibold tabular-nums">{period.successRate.toFixed(2)}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${label} delivery success rate`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={period.successRate}>
                        <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${period.successRate}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="recent-orders-title">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="recent-orders-title" className="text-lg font-semibold">Recent parcels</h2>
                <p className="text-sm text-muted-foreground">Your latest five parcels and their tracking details.</p>
              </div>
              <span className="text-sm text-muted-foreground">{dashboard.recentOrders.length} shown</span>
            </div>
            {dashboard.recentOrders.length === 0 ? (
              <Card><CardContent className="flex min-h-36 flex-col items-center justify-center gap-2 text-center">
                <Package aria-hidden="true" className="size-6 text-muted-foreground" />
                <p className="font-medium">No parcels yet</p>
                <p className="text-sm text-muted-foreground">New parcels will appear here after they’re created.</p>
              </CardContent></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                    <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">Order</th>
                        <th scope="col" className="px-4 py-3 font-medium">Recipient</th>
                        <th scope="col" className="px-4 py-3 font-medium">Parcel</th>
                        <th scope="col" className="px-4 py-3 font-medium">Status</th>
                        <th scope="col" className="px-4 py-3 font-medium">Created</th>
                        <th scope="col" className="px-4 py-3 font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dashboard.recentOrders.map((order) => {
                        const expanded = expandedOrderId === order.id;
                        return (
                          <OrderRows
                            key={order.id}
                            order={order}
                            expanded={expanded}
                            onToggle={() => setExpandedOrderId(expanded ? null : order.id)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function OrderRows({
  order,
  expanded,
  onToggle,
}: {
  order: NonNullable<ReturnType<typeof useSmeDashboard>["dashboard"]>["recentOrders"][number];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="align-middle">
        <th scope="row" className="px-4 py-3 font-medium">{order.orderCode}</th>
        <td className="px-4 py-3"><div className="font-medium">{order.recipient.name}</div><div className="text-xs text-muted-foreground">{order.recipient.township}</div></td>
        <td className="px-4 py-3"><div>{order.parcel.weight} kg</div><div className="text-xs text-muted-foreground">COD {order.parcel.codAmount} {order.parcel.currency}</div></td>
        <td className="px-4 py-3"><StatusPill status={order.status} /></td>
        <td className="px-4 py-3 text-muted-foreground">{formatDate(order.createdAt)}</td>
        <td className="px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} details for ${order.orderCode}`}>
            {expanded ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
            {expanded ? "Hide" : "View"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-muted/20 px-4 py-5">
            <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr_auto]">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Order information</h3>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="text-muted-foreground">Phone</span><p className="mt-1 font-medium">{order.recipient.phoneNumber}</p></div>
                  <div><span className="text-muted-foreground">Township</span><p className="mt-1 font-medium">{order.recipient.township}</p></div>
                  <div className="sm:col-span-2"><span className="text-muted-foreground">Delivery address</span><p className="mt-1 flex gap-2 font-medium"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{order.recipient.deliveryAddress}</p></div>
                  {order.parcel.deliveryInstructions && <div className="sm:col-span-2"><span className="text-muted-foreground">Instructions</span><p className="mt-1">{order.parcel.deliveryInstructions}</p></div>}
                  <div><span className="text-muted-foreground">Operator</span><p className="mt-1 flex items-center gap-2 font-medium"><UserRound aria-hidden="true" className="size-4 text-muted-foreground" />{order.operator?.fullName ?? "Not assigned"}</p>{order.operator?.phone && <p className="mt-1 text-xs text-muted-foreground">{order.operator.phone}</p>}</div>
                  <div><span className="text-muted-foreground">Delivery rider</span><p className="mt-1 flex items-center gap-2 font-medium"><Truck aria-hidden="true" className="size-4 text-muted-foreground" />{order.deliveryRider ? "Assigned" : "Not assigned"}</p></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Tracking timeline</h3>
                <ol className="space-y-3">
                  {order.trackingTimeline.map((event, index) => (
                    <li key={`${event.createdAt}-${event.status}-${index}`} className="relative flex gap-3">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${index === order.trackingTimeline.length - 1 ? "bg-emerald-600" : "bg-zinc-300"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{formatStatus(event.status)}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-3" />{formatTime(event.createdAt)}</p>
                        {event.actor?.fullName && <p className="mt-0.5 text-xs text-muted-foreground">{event.actor.fullName}</p>}
                        {event.note && <p className="mt-1 break-words text-xs text-muted-foreground">{event.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col items-start gap-2 lg:items-center">
                <span className="flex items-center gap-2 text-sm font-semibold"><QrCode aria-hidden="true" className="size-4" />Parcel QR</span>
                <Image src={order.qr.imageDataUrl} alt={`QR code for ${order.orderCode}`} width={112} height={112} unoptimized className="size-28 rounded-md border bg-white p-2" />
                <span className="max-w-32 break-all text-center font-mono text-[10px] text-muted-foreground">{order.qr.identifier}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}