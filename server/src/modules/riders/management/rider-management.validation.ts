import { z } from "zod";
export const workloadSchema = z.enum(["AVAILABLE", "HAS_ASSIGNED_TASKS", "DELIVERING"]);
export const riderManagementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  workload: workloadSchema.optional(),
  eligible: z.literal("true").optional(),
}).strict();
export const riderDetailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type RiderManagementQuery = z.infer<typeof riderManagementQuerySchema>;
export type RiderDetailQuery = z.infer<typeof riderDetailQuerySchema>;
