"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  Ban, CheckCircle2, ChevronRight, CircleX, MapPin, Package, QrCode, RefreshCw, Scale, TriangleAlert, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParcelStatusBadge } from "@/features/operator/components/parcel-status-badge";
import { formatParcelDecimal } from "@/features/operator/format";
import { useAuthStore } from "@/stores/auth.store";
import { getMyAssignments } from "../api/deliveries.api";
import { useDeliveryResource } from "../hooks/use-deliveries";
import { DeliveryPagination } from "./delivery-shared";
import { ParcelScanDialog } from "./parcel-scan-dialog";
import {
  activeDeliveryStatuses, completedDeliveryStatuses,
  type Assignment, type RiderDeliveryQuery,
} from "../types/delivery.types";

type Tab = "active" | "completed";
type ActiveFilter = "ALL" | (typeof activeDeliveryStatuses)[number];

const filters = [
  { value: "ALL" as const, label: "All" },
  { value: "PICKED_UP" as const, label: "Picked Up" },
  { value: "IN_TRANSIT" as const, label: "In Transit" },
  { value: "OUT_FOR_DELIVERY" as const, label: "Out for Delivery" },
] satisfies { value: ActiveFilter; label: string }[];

const load = (key: string) => getMyAssignments(JSON.parse(key) as RiderDeliveryQuery);
const pageSize = 20;
const activeSet = new Set<string>(activeDeliveryStatuses);
const completedSet = new Set<string>(completedDeliveryStatuses);

function belongsToTab(tab: Tab, status: string) {
  return tab === "active" ? activeSet.has(status) : completedSet.has(status);
}

function deliveryState(status: string) {
  if (status === "DELIVERED") return { Icon: CheckCircle2, label: "Delivery completed", tone: "text-emerald-700" };
  if (status === "FAILED") return { Icon: CircleX, label: "Delivery failed", tone: "text-red-600" };
  if (status === "CANCELLED") return { Icon: Ban, label: "Delivery cancelled", tone: "text-muted-foreground" };
  return { Icon: Truck, label: "Delivery in progress", tone: "text-muted-foreground" };
}

export function RiderDashboard() {
  const user = useAuthStore(state => state.user);
  const [tab, setTab] = useState<Tab>("active");
  const [filter, setFilter] = useState<ActiveFilter>("ALL");
  const [page, setPage] = useState(1);
  const [scanOpen, setScanOpen] = useState(false);
  const query = useDeliveryResource("RIDER", JSON.stringify({
    page, pageSize, group: tab,
    ...(tab === "active" && filter !== "ALL" ? { status: filter } : {}),
  }), load);
  const counts = query.data?.counts;
  const items = (query.data?.assignments ?? []).filter(item => belongsToTab(tab, item.order.status));
  const pagination = query.data?.pagination;
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || "Rider";
  const filterCount = (value: ActiveFilter) => value === "ALL" ? counts?.active.all : counts?.active[value];
  const tabCount = (value: Tab) => value === "active" ? counts?.active.all : counts?.completed.all;

  useEffect(() => {
    const resetPage = () => setPage(1);
    window.addEventListener("deliveries-changed", resetPage);
    return () => window.removeEventListener("deliveries-changed", resetPage);
  }, []);

  function refresh() {
    setPage(1);
    query.retry();
  }

  function selectTab(next: Tab) {
    setTab(next);
    setFilter("ALL");
    setPage(1);
  }

  function selectFilter(next: ActiveFilter) {
    setFilter(next);
    setPage(1);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: Tab = event.key === "Home" ? "active" : event.key === "End" ? "completed" : tab === "active" ? "completed" : "active";
    selectTab(next);
    document.getElementById(`deliveries-tab-${next}`)?.focus();
  }

  const activeFilterEmpty = tab === "active" && filter !== "ALL" && items.length === 0
    && (counts?.active.all ?? 0) > 0 && (filterCount(filter) ?? 0) === 0;
  const emptyTitle = activeFilterEmpty
    ? `No ${filters.find(item => item.value === filter)?.label} deliveries right now`
    : tab === "active" ? "No active deliveries right now" : "No completed deliveries yet";
  const emptyDescription = activeFilterEmpty
    ? "Choose another filter to see your other active deliveries."
    : tab === "active" ? "New assignments from your Operator appear here." : "Delivered, failed and cancelled parcels appear here.";

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground">Hello, {firstName}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/rider/incidents"
            aria-label="Incidents"
            className="inline-flex size-10 items-center justify-center rounded-full border bg-card text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <TriangleAlert aria-hidden="true" className="size-4 text-amber-600" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh deliveries"
            onClick={refresh}
            disabled={query.isLoading}
            className="size-10 rounded-full"
          >
            <RefreshCw aria-hidden="true" className={query.isLoading ? "animate-spin" : undefined} />
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="w-full min-w-0 rounded-2xl bg-gradient-to-br from-[#0B63F6] to-[#0A4FD0] p-4 text-left text-white shadow-[0_10px_24px_rgba(11,99,246,0.22)] transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
            <QrCode aria-hidden="true" className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Scan Parcel QR Code</span>
            <span className="block text-sm text-white/80">Open an assigned parcel to continue</span>
          </span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10">
            <ChevronRight aria-hidden="true" className="size-5 text-white" />
          </span>
        </span>
      </button>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e4ebf5] bg-card shadow-[0_2px_10px_rgba(27,47,90,0.04)]">
        <div role="tablist" aria-label="Delivery categories" className="grid grid-cols-2">
          {([["active", "My Deliveries"], ["completed", "Completed"]] as const).map(([value, label]) => {
            const count = tabCount(value);
            return (
              <button
                key={value}
                id={`deliveries-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-controls="deliveries-panel"
                tabIndex={tab === value ? 0 : -1}
                aria-label={count === undefined ? label : `${label}, ${count} ${count === 1 ? "delivery" : "deliveries"}`}
                onClick={() => selectTab(value)}
                onKeyDown={handleTabKeyDown}
                className={`relative flex min-h-12 items-center justify-center gap-1.5 px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${tab === value ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
                {count !== undefined && (
                  <span aria-hidden="true" className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${tab === value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                )}
                {tab === value && <span aria-hidden="true" className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        {tab === "active" && (
          <div
            id="active-delivery-filters"
            role="group"
            aria-label="Active delivery filters"
            className="overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-max gap-2">
              {filters.map(({ value, label }) => {
                const selected = filter === value;
                const count = filterCount(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    aria-label={count === undefined ? label : `${label}, ${count} ${count === 1 ? "delivery" : "deliveries"}`}
                    onClick={() => selectFilter(value)}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "bg-primary text-primary-foreground shadow-sm" : "border border-[#dbe6f5] bg-white text-[#3f587a] hover:bg-[#eef4ff]"}`}
                  >
                    {label}
                    {count !== undefined && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${selected ? "bg-white/20 text-white" : "bg-[#eef4ff] text-[#496485]"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        id="deliveries-panel"
        role="tabpanel"
        aria-labelledby={`deliveries-tab-${tab}`}
        className="min-w-0 space-y-3"
      >
        {query.isLoading && (
          <div role="status" className="space-y-3">
            <div className="h-36 animate-pulse rounded-2xl border bg-card" />
            <div className="h-36 animate-pulse rounded-2xl border bg-card" />
            <span className="sr-only">Loading your deliveries…</span>
          </div>
        )}

        {!query.isLoading && query.error && (
          <div role="alert" className="space-y-3 rounded-2xl border bg-card p-5">
            <p className="text-sm">{query.error}</p>
            <Button variant="outline" onClick={refresh} className="min-h-11">
              <RefreshCw aria-hidden="true" />Try again
            </Button>
          </div>
        )}

        {!query.isLoading && !query.error && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#cddcf0] bg-card p-8 text-center">
            <Package aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">{emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        )}

        {!query.isLoading && !query.error && items.map(item => {
          const destination = item.order.destinationCity?.trim() || item.order.township;
          const state = deliveryState(item.order.status);
          return (
            <DeliveryCard key={item.id} item={item} destination={destination} state={state} />
          );
        })}

        {!query.isLoading && !query.error && pagination && pagination.totalPages > 1 && (
          <DeliveryPagination page={page} totalPages={pagination.totalPages} total={pagination.total} onPage={setPage} />
        )}
      </div>

      <ParcelScanDialog open={scanOpen} onOpenChange={setScanOpen} onCompleted={refresh} />
    </div>
  );
}

function DeliveryCard({ item, destination, state }: {
  item: Assignment;
  destination: string;
  state: ReturnType<typeof deliveryState>;
}) {
  const { Icon: StateIcon } = state;
  return (
    <Link
      href={`/rider/assignments/${item.id}`}
      aria-label={`View delivery ${item.order.orderCode}`}
      className="group block min-w-0 rounded-2xl border border-[#e4ebf5] bg-card p-4 shadow-[0_2px_10px_rgba(27,47,90,0.04)] transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <Package aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-bold tracking-tight">{item.order.orderCode}</p>
              <p className="truncate text-sm text-muted-foreground">{item.order.recipientName}</p>
            </div>
            <span className="shrink-0"><ParcelStatusBadge status={item.order.status} /></span>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">To {destination}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Scale aria-hidden="true" className="size-4 shrink-0" />
              {formatParcelDecimal(item.order.parcelWeight)} {item.order.parcelWeightUnit}
            </span>
          </div>

          <div className="mt-3 flex min-w-0 items-center justify-between gap-2 border-t pt-3">
            <span className={`flex min-w-0 items-center gap-1.5 text-xs ${state.tone}`}>
              <StateIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{state.label}</span>
            </span>
            <span className="inline-flex min-h-8 shrink-0 items-center gap-1 text-sm font-semibold text-primary">
              Details<ChevronRight aria-hidden="true" className="size-4 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
