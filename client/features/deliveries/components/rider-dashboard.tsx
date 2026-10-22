"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, ChevronRight, CircleX, MapPin, Package, QrCode, RefreshCw, ScanLine, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ParcelStatusBadge } from "@/features/operator/components/parcel-status-badge";
import { formatParcelDate, formatParcelDecimal } from "@/features/operator/format";
import { useAuthStore } from "@/stores/auth.store";
import { getMyAssignments } from "../api/deliveries.api";
import { useDeliveryResource } from "../hooks/use-deliveries";
import type { DeliveryQuery } from "../types/delivery.types";

type Tab = "active" | "completed";
const activeStatuses = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"];
const load = (key: string) => getMyAssignments(JSON.parse(key) as DeliveryQuery);

export function RiderDashboard() {
  const user = useAuthStore(state => state.user);
  const [tab, setTab] = useState<Tab>("active");
  const [scanOpen, setScanOpen] = useState(false);
  const query = useDeliveryResource("RIDER", JSON.stringify({ page: 1, pageSize: 100 }), load);
  const items = query.data?.assignments ?? [];
  const active = items.filter(item => activeStatuses.includes(item.order.status));
  const completed = items.filter(item => !activeStatuses.includes(item.order.status));
  const visible = tab === "active" ? active : completed;
  const firstName = user?.fullName?.trim().split(/\s+/)[0] ?? "Rider";

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Hello, {firstName}</p>
          <h1 className="text-2xl font-bold tracking-tight">My Deliveries</h1>
        </div>
        <Button variant="outline" size="sm" onClick={query.retry} disabled={query.isLoading} className="min-h-10">
          <RefreshCw aria-hidden="true" className={query.isLoading ? "animate-spin" : undefined} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="w-full rounded-2xl bg-gradient-to-br from-[#0B63F6] to-[#0A4FD0] p-4 text-left text-white shadow-[0_10px_24px_rgba(11,99,246,0.22)] transition active:translate-y-px"
      >
        <span className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15"><QrCode aria-hidden="true" className="size-7" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Scan Parcel QR Code</span>
            <span className="block text-sm text-white/80">Quickly open an assigned parcel</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 text-white/80" />
        </span>
      </button>

      <div role="tablist" aria-label="Delivery categories" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {([[
          "active", "Active", active.length, Truck,
        ], [
          "completed", "Completed", completed.length, CheckCircle2,
        ]] as const).map(([value, label, count, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`deliveries-${value}`}
            onClick={() => setTab(value)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${tab === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
            <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      <div id={`deliveries-${tab}`} role="tabpanel" aria-label={`${tab === "active" ? "Active" : "Completed"} deliveries`} className="space-y-3">
        {query.isLoading && (
          <div role="status" className="space-y-3">
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            <span className="sr-only">Loading your deliveries…</span>
          </div>
        )}
        {!query.isLoading && query.error && (
          <div role="alert" className="space-y-3 rounded-2xl border bg-card p-5">
            <p className="text-sm">{query.error}</p>
            <Button variant="outline" onClick={query.retry} className="min-h-11"><RefreshCw aria-hidden="true" />Retry</Button>
          </div>
        )}
        {!query.isLoading && !query.error && visible.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
            <Package aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">{tab === "active" ? "No active deliveries right now" : "No completed deliveries yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tab === "active" ? "New assignments from your Operator appear here." : "Delivered, failed and cancelled parcels appear here."}</p>
          </div>
        )}
        {visible.map(item => (
          <article key={item.id} className="rounded-2xl border bg-card p-4 shadow-[0_2px_10px_rgba(27,47,90,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Package aria-hidden="true" className="size-5" /></span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold">{item.order.orderCode}</p>
                  <p className="truncate text-sm text-muted-foreground">{item.order.recipientName}</p>
                </div>
              </div>
              <ParcelStatusBadge status={item.order.status} />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{item.order.deliveryAddress}, {item.order.township}</span></p>
              <p className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                <span>Assigned {formatParcelDate(item.assignedAt)}</span>
                <span className="font-medium text-foreground">COD {item.order.currency} {formatParcelDecimal(item.order.codAmount)}</span>
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {item.order.status === "FAILED" ? <CircleX aria-hidden="true" className="size-3.5" /> : <ScanLine aria-hidden="true" className="size-3.5" />}
                {item.order.status === "FAILED" ? "Delivery failed" : item.order.status === "DELIVERED" ? "Delivery completed" : "Delivery in progress"}
              </span>
              <Link href={`/rider/assignments/${item.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary">View details <ChevronRight aria-hidden="true" className="size-4" /></Link>
            </div>
          </article>
        ))}
        {!query.isLoading && !query.error && (query.data?.pagination.total ?? 0) > items.length && (
          <p className="text-center text-xs text-muted-foreground">Showing the latest {items.length} of {query.data?.pagination.total} deliveries.</p>
        )}
      </div>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">QR scanning is coming soon</DialogTitle>
          <DialogDescription>
            Parcel QR scanning and custody verification are not available yet. This shortcut does not verify that a parcel is in your custody. Open an assigned parcel from My Deliveries to continue.
          </DialogDescription>
          <Button onClick={() => setScanOpen(false)} className="min-h-11 w-full">Back to My Deliveries</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
