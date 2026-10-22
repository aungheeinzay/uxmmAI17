import type { OrderStatus } from "../../../generated/prisma/enums";
export const warehouseStates = ["UNASSIGNED", "ASSIGNED", "DISPATCHED", "COMPLETED", "EXCEPTION"] as const;
export type WarehouseState = typeof warehouseStates[number];
export function deriveWarehouseState(status: OrderStatus, hasAssignment: boolean): WarehouseState | null {
  if (status === "PICKED_UP") return hasAssignment ? "ASSIGNED" : "UNASSIGNED";
  if (status === "IN_TRANSIT" || status === "OUT_FOR_DELIVERY") return "DISPATCHED";
  if (status === "DELIVERED") return "COMPLETED";
  if (status === "FAILED") return "EXCEPTION";
  return null;
}
