"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useSmeDashboard } from "../hooks/use-sme-dashboard";
import { useParcelSearch } from "../hooks/use-parcel-search";
import { useOrderList } from "../hooks/use-order-list";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { MonthlyCostSummary } from "./monthly-cost-summary";
import { ParcelMetricGrid } from "./parcel-metric-grid";
import { ParcelOverviewHeader, type ParcelOverviewView } from "./parcel-overview-header";
import { RecentParcels } from "./recent-parcels";
import { RecentShipmentsCallout } from "./recent-shipments-callout";
import { ParcelListTable } from "./parcel-list-table";
import { ParcelPagination } from "./parcel-pagination";
import { ParcelListSkeleton } from "./parcel-list-skeleton";

export function SmeDashboard() {
  const { dashboard, isLoading, hasError, refresh } = useSmeDashboard();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [view, setView] = useState<ParcelOverviewView>("overview");
  const search = useParcelSearch(dashboard?.recentOrders ?? []);
  const user = useAuthStore((state) => state.user);
  const allOrders = useOrderList({ enabled: view === "all" });

  return (
    <div className="space-y-8 pb-10">
      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>We couldn’t load your parcel summary. Check your connection and try again.</span>
            <Button variant="brand" size="sm" onClick={refresh}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && !dashboard ? (
        <DashboardSkeleton />
      ) : (
        dashboard && (
          <>
            <ParcelOverviewHeader
              userName={user?.fullName}
              totalParcels={dashboard.totalParcels}
              activeView={view}
              onViewChange={setView}
              actions={
                <Button
                  variant="outline"
                  size="icon"
                  onClick={refresh}
                  disabled={isLoading}
                  aria-label="Refresh dashboard"
                  title="Refresh dashboard"
                  className="size-9"
                >
                  <RefreshCw aria-hidden="true" className={isLoading ? "motion-safe:animate-spin" : ""} />
                </Button>
              }
            />

            {view === "overview" ? (
              <>
                <ParcelMetricGrid
                  totalParcels={dashboard.totalParcels}
                  pendingPickup={dashboard.statusCounts.CREATED}
                  atWarehouse={dashboard.statusCounts.PICKED_UP}
                  inTransit={dashboard.statusCounts.IN_TRANSIT}
                  delivered={dashboard.statusCounts.DELIVERED}
                  failed={dashboard.statusCounts.FAILED + dashboard.statusCounts.CANCELLED}
                />

<section className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 text-[#F97316]" />
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-[#C2410C]">Damaged parcel box policy</p>
          <p className="text-[12px] leading-relaxed text-[#9A3412]">
            If a recipient reports a damaged box upon delivery, ensure photo evidence is captured before opening.
            Claims must be filed with the delivery operator within 24 hours.
          </p>
        </div>
      </div>
    </section>

                <MonthlyCostSummary
                  entries={dashboard.monthlyCosts.map((entry) => ({ month: entry.month, cost: Number(entry.cost) }))}
                  currency={dashboard.monthlyCosts[0]?.currency ?? "MMK"}
                />
              </>
            ) : view === "recent" ? (
              <RecentParcels
                orders={search.filtered}
                totalCount={dashboard.recentOrders.length}
                query={search.query}
                onQueryChange={search.setQuery}
                expandedOrderId={expandedOrderId}
                onToggle={(orderId) => setExpandedOrderId((current) => (current === orderId ? null : orderId))}
              />
            ) : (
              <section aria-labelledby="all-shipments-heading" className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h2 id="all-shipments-heading" className="text-heading-2 font-bold tracking-tight text-foreground">
                    All shipments
                  </h2>
                  <p className="text-body-md text-muted-foreground">Every parcel in your workspace with current status.</p>
                </div>
                {allOrders.hasError && (
                  <Alert variant="destructive">
                    <AlertTitle>Shipments unavailable</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                      <span>We couldn’t load your shipments. Check your connection and try again.</span>
                      <Button variant="brand" size="sm" onClick={allOrders.refresh}>
                        Try again
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {allOrders.isLoading && !allOrders.orders ? (
                  <ParcelListSkeleton />
                ) : (
                  <ParcelListTable
                    orders={allOrders.orders?.orders ?? []}
                    isRefreshing={allOrders.isLoading}
                    search={allOrders.search}
                    onSearchChange={allOrders.setSearch}
                    status={allOrders.status}
                    onStatusChange={allOrders.setStatus}
                    emptyTitle={allOrders.status ? "No parcels with this status" : "No parcels yet"}
                    emptyDescription={
                      allOrders.status
                        ? "No parcel currently holds the selected status."
                        : "New parcels will appear here as they’re created."
                    }
                  />
                )}
                {allOrders.orders ? (
                  <ParcelPagination
                    pagination={allOrders.orders.pagination}
                    onPageChange={allOrders.setPage}
                  />
                ) : null}
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}
