"use client";
import { getOperatorOrders } from "../api/operator-orders.api";
import type { OperatorOrdersQuery } from "../types/operator-order.types";
import { useOperatorResource } from "./use-operator-resource";
const load = (key: string) => getOperatorOrders(JSON.parse(key) as OperatorOrdersQuery);
export function useOperatorOrders(query: OperatorOrdersQuery) {
  return useOperatorResource(JSON.stringify(query), load);
}
