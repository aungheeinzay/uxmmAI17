"use client";
import { getWarehouseOverview, getWarehouseParcels } from "../api/warehouse.api";
import type { WarehouseQuery } from "../types/warehouse.types";
import { useOperatorResource } from "./use-operator-resource";
const loadParcels = (key: string) => getWarehouseParcels(JSON.parse(key) as WarehouseQuery);
export function useWarehouseOverview() { return useOperatorResource("warehouse-overview", getWarehouseOverview); }
export function useWarehouseParcels(query: WarehouseQuery) { return useOperatorResource(JSON.stringify(query), loadParcels); }
