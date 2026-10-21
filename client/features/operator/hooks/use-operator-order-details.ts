"use client";
import { getOperatorOrder } from "../api/operator-orders.api";
import { useOperatorResource } from "./use-operator-resource";
export function useOperatorOrderDetails(id: string) { return useOperatorResource(id, getOperatorOrder); }
