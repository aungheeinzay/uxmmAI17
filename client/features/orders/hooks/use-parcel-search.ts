"use client";

import { useState } from "react";
import type { DashboardOrder } from "../schemas/sme-dashboard.schema";

export function useParcelSearch(orders: DashboardOrder[]) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const filtered =
    term === ""
      ? orders
      : orders.filter(
          (order) =>
            order.orderCode.toLowerCase().includes(term) ||
            order.recipient.name.toLowerCase().includes(term) ||
            order.recipient.township.toLowerCase().includes(term)
        );

  return { query, setQuery, filtered };
}
