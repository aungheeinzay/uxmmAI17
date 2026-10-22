import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { warehouseListSchema, warehouseOverviewSchema, warehouseQuerySchema, type WarehouseQuery } from "../types/warehouse.types";
export async function getWarehouseOverview() {
  const result = z.object({ success: z.literal(true), data: warehouseOverviewSchema }).safeParse(await postSessionJson("operator/warehouse/overview", {}));
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
export async function getWarehouseParcels(query: WarehouseQuery) {
  const result = z.object({ success: z.literal(true), data: warehouseListSchema }).safeParse(await postSessionJson("operator/warehouse/parcels", warehouseQuerySchema.parse(query)));
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
