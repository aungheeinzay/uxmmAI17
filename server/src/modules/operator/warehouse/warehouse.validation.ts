import { z } from "zod";
import { warehouseStates } from "./warehouse.state";
export const warehouseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  township: z.string().trim().min(1).max(120).optional(),
  createdDate: z.iso.date().optional(),
  warehouseState: z.enum(warehouseStates).optional(),
}).strict();
export const warehouseOverviewQuerySchema = z.object({}).strict();
export type WarehouseQuery = z.infer<typeof warehouseQuerySchema>;
