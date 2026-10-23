"use client";

import { useCallback, useEffect, useState } from "react";
import { getOrders, type OrderListQuery } from "../api/order.api";
import type { OrderList, OrderStatus, OrderTab } from "../schemas/order-list.schema";

export const orderListPageSize = 10;

export function useOrderList(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [orders, setOrders] = useState<OrderList | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTabState] = useState<OrderTab>("all");
  const [page, setPageState] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatusState] = useState<OrderStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const query: OrderListQuery = {
      page,
      pageSize: orderListPageSize,
      search: search || undefined,
      status: status ?? undefined,
      tab,
    };
    void getOrders(query).then((result) => {
      if (!active) return;
      setOrders(result);
      setHasError(false);
    }).catch(() => {
      if (active) setHasError(true);
    }).finally(() => {
      if (active) setIsFetching(false);
    });
    return () => { active = false; };
  }, [page, tab, search, status, attempt, enabled]);

  const isLoading = enabled && (isFetching || (orders === null && !hasError));

  const refresh = useCallback(() => {
    setHasError(false);
    setIsFetching(true);
    setAttempt((current) => current + 1);
  }, []);

  // A status filter replaces the saved view, so the tab never contradicts the filtered rows.
  function setTab(next: OrderTab) {
    if (next === tab && status === null) return;
    setHasError(false);
    setIsFetching(true);
    setTabState(next);
    setStatusState(null);
    setPageState(1);
  }

  // The backend gives an explicit status precedence over the tab, so the tab resets to "all".
  function setStatus(next: OrderStatus | null) {
    if (next === status) return;
    setHasError(false);
    setIsFetching(true);
    setStatusState(next);
    setTabState("all");
    setPageState(1);
  }

  function setPage(next: number) {
    if (next === page) return;
    setHasError(false);
    setIsFetching(true);
    setPageState(next);
  }

  function updateSearch(next: string) {
    setHasError(false);
    setIsFetching(true);
    setSearch(next);
    setPageState(1);
  }

  return {
    orders,
    isLoading,
    hasError,
    refresh,
    tab,
    setTab,
    page,
    setPage,
    search,
    setSearch: updateSearch,
    status,
    setStatus,
  };
}
