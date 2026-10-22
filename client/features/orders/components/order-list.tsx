"use client";

import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { useOrderList } from "../hooks/use-order-list";
import type { OrderTab } from "../schemas/order-list.schema";
import { ParcelListSkeleton } from "./parcel-list-skeleton";
import { ParcelListTable } from "./parcel-list-table";
import { ParcelPagination } from "./parcel-pagination";
import { ParcelTabs } from "./parcel-tabs";

const emptyCopy: Record<OrderTab, { title: string; description: string }> = {
  all: {
    title: "No parcels yet",
    description: "Create your first parcel to start tracking deliveries.",
  },
  needs_pickup: {
    title: "Nothing needs pickup",
    description: "Parcels waiting for an Operator pickup will appear here.",
  },
  exceptions: {
    title: "No exceptions",
    description: "Failed or cancelled parcels will appear here.",
  },
};

export function OrderList() {
  const { orders, isLoading, hasError, refresh, tab, setTab, setPage, search, setSearch, status, setStatus } = useOrderList();
  const isFirstLoad = isLoading && !orders;
  const emptyTitle = search
    ? "No matching parcels"
    : status
      ? "No parcels with this status"
      : emptyCopy[tab].title;
  const emptyDescription = search
    ? "Try a different order code or recipient name."
    : status
      ? "No parcel currently holds the selected status."
      : emptyCopy[tab].description;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="SME workspace"
        title="All parcels"
        description="Every parcel you've created, with pickup needs and exceptions in one place."
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              disabled={isLoading}
              aria-label="Refresh parcels"
              title="Refresh parcels"
              className="size-9"
            >
              <RefreshCw aria-hidden="true" className={isLoading ? "motion-safe:animate-spin" : ""} />
            </Button>
            <Button variant="default" asChild>
              <Link href="/seller/order/new">
                <Plus aria-hidden="true" />
                Create parcel
              </Link>
            </Button>
          </>
        }
      />

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>Parcels unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>We couldn’t load your parcels. Check your connection and try again.</span>
            <Button variant="brand" size="sm" onClick={refresh}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <ParcelTabs activeTab={tab} onTabChange={setTab} counts={orders?.tabCounts ?? null} />

      {isFirstLoad ? (
        <ParcelListSkeleton />
      ) : orders ? (
        <div className="space-y-4">
          <ParcelListTable
            orders={orders.orders}
            isRefreshing={isLoading}
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
          {orders.orders.length > 0 && (
            <ParcelPagination pagination={orders.pagination} onPageChange={setPage} disabled={isLoading} />
          )}
        </div>
      ) : null}
    </div>
  );
}
