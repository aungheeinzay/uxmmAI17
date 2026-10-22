"use client";

import { useEffect, useState } from "react";
import { getOrderDetail, getOrderQr, getOrderStatus } from "@/features/orders/api/order.api";
import type { OrderDetail, OrderQr } from "@/features/orders/schemas/order-detail.schema";
import type { OrderStatusView } from "@/features/orders/schemas/order-status.schema";

type ParcelDetailsResult = {
  identifier: string;
  detail: OrderDetail | null;
  status: OrderStatusView | null;
  qr: OrderQr | null;
  hasError: boolean;
};

export function useParcelDetails(identifier: string) {
  const [result, setResult] = useState<ParcelDetailsResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    void Promise.allSettled([
      getOrderDetail(identifier),
      getOrderStatus(identifier),
      getOrderQr(identifier),
    ]).then(([detailResult, statusResult, qrResult]) => {
      if (!active) return;
      setResult({
        identifier,
        detail: detailResult.status === "fulfilled" ? detailResult.value : null,
        status: statusResult.status === "fulfilled" ? statusResult.value : null,
        qr: qrResult.status === "fulfilled" ? qrResult.value : null,
        hasError: detailResult.status === "rejected",
      });
    }).finally(() => {
      if (active) setIsRefreshing(false);
    });

    return () => {
      active = false;
    };
  }, [identifier, attempt]);

  function refresh() {
    setIsRefreshing(true);
    setAttempt((current) => current + 1);
  }

  const matched = result?.identifier === identifier ? result : null;

  return {
    detail: matched?.detail ?? null,
    status: matched?.status ?? null,
    qr: matched?.qr ?? null,
    isLoading: matched === null,
    isRefreshing,
    hasError: matched?.hasError ?? false,
    refresh,
  };
}
