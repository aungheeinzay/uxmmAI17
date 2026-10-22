import { z } from "zod";
import { riderProfileUpdateSchema } from "../profile/rider-profile.validation";
export const workloadSchema = z.enum(["AVAILABLE", "HAS_ASSIGNED_TASKS", "DELIVERING"]);
export const riderOperationalStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const riderManagementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  workload: workloadSchema.optional(),
  status: riderOperationalStatusSchema.optional(),
  eligible: z.literal("true").optional(),
}).strict();
export const riderDetailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
// Reuses the Rider-owned validation so Operators cannot supply protected fields.
export const operatorRiderUpdateSchema = riderProfileUpdateSchema;
export const emptyBodySchema = z.object({}).strict();
export type RiderManagementQuery = z.infer<typeof riderManagementQuerySchema>;
export type RiderDetailQuery = z.infer<typeof riderDetailQuerySchema>;
export type OperatorRiderUpdateInput = z.infer<typeof operatorRiderUpdateSchema>;
