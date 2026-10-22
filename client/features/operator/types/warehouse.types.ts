import { z } from "zod";
import { operatorOrderSchema, operatorOrderListSchema } from "./operator-order.types";
export const warehouseStates = ["UNASSIGNED", "ASSIGNED", "DISPATCHED", "COMPLETED", "EXCEPTION"] as const;
export const warehouseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(), township: z.string().trim().min(1).max(120).optional(),
  createdDate: z.iso.date().optional(), warehouseState: z.enum(warehouseStates).optional(),
}).strict();
export const warehouseFilterSchema = z.object({ search: z.string().trim().max(120), township: z.string().trim().max(120),
  createdDate: z.union([z.iso.date(), z.literal("")]), warehouseState: z.union([z.enum(warehouseStates), z.literal("")]) });
export const warehouseAssignmentSchema = z.object({ id: z.string().uuid(), riderId: z.string().uuid(), assignedById: z.string().uuid(), assignedAt: z.iso.datetime(),
  rider: z.object({ id: z.string().uuid(), fullName: z.string().nullable(), phone: z.string().nullable() }) });
export const warehouseOrderSchema = operatorOrderSchema.extend({ warehouseState: z.enum(warehouseStates), assignment: warehouseAssignmentSchema.nullable() });
export const warehouseListSchema = z.object({ orders: z.array(warehouseOrderSchema), pagination: operatorOrderListSchema.shape.pagination });
const count = z.number().int().nonnegative();
export const warehouseOverviewSchema = z.object({ scope: z.literal("ALL_TIME"), unassigned: count, assignedAwaitingDispatch: count,
  receivedAwaitingDispatch: count, dispatched: count, completed: count, exceptions: count }).refine(data => data.receivedAwaitingDispatch === data.unassigned + data.assignedAwaitingDispatch);
export type WarehouseQuery = z.infer<typeof warehouseQuerySchema>;
export type WarehouseFilters = z.infer<typeof warehouseFilterSchema>;
export type WarehouseOrder = z.infer<typeof warehouseOrderSchema>;
export function warehouseSearchParams(query: WarehouseQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  return params;
}
export const warehouseLabels = { UNASSIGNED: "Unassigned", ASSIGNED: "Assigned / awaiting dispatch", DISPATCHED: "Dispatched", COMPLETED: "Completed", EXCEPTION: "Exception" };
