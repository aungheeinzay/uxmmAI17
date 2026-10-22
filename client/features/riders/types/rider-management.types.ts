import { z } from "zod";
import { orderStatuses } from "@/features/operator/types/operator-order.types";
import { riderProfileUpdateRequestSchema, riderVehicleSchema } from "@/features/rider-profile/types/rider-profile.types";
const orderStatusSchema = z.enum(orderStatuses);
export const workloadSchema = z.enum(["AVAILABLE", "HAS_ASSIGNED_TASKS", "DELIVERING"]);
export const riderOperationalStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const riderQuerySchema = z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20), search: z.string().trim().min(1).max(120).optional(), workload: workloadSchema.optional(), status: riderOperationalStatusSchema.optional() }).strict();
export const pageSchema = z.object({ page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), total: z.number().int().min(0), totalPages: z.number().int().min(0) });
const count = z.number().int().min(0);
export const managedRiderSchema = z.object({ id: z.string().uuid(), fullName: z.string().nullable(), phone: z.string().nullable(), email: z.string().email().nullable(), providerId: z.string().uuid(), provider: z.object({ id: z.string().uuid(), name: z.string() }),
  accountStatus: z.enum(["ACTIVATED", "UNVERIFIED", "NO_ACCOUNT"]), isActive: z.boolean(), deactivatedAt: z.iso.datetime().nullable(),
  vehicle: riderVehicleSchema, profileComplete: z.boolean(), missingFields: z.array(z.string()), completedAt: z.iso.datetime().nullable(), workload: workloadSchema,
  assignedTaskCount: count, inProgressDeliveryCount: count, activeAssignedTaskCount: count, completedDeliveryCount: count });
export const riderListSchema = z.object({ riders: z.array(managedRiderSchema), pagination: pageSchema });
export const riderMutationSchema = z.object({ rider: managedRiderSchema });
export const riderOverviewSchema = z.object({ totalRiders: count, available: count, assigned: count, delivering: count, inactive: count });
export const pendingInvitationsSchema = z.object({ invitations: z.array(z.object({ id: z.string().uuid(), email: z.string().email(), fullName: z.string().nullable(), createdAt: z.string(), expiresAt: z.string() })), pagination: pageSchema });
export const managementDetailSchema = z.object({ rider: managedRiderSchema, pagination: pageSchema, assignments: z.array(z.object({ id: z.string().uuid(), orderId: z.string().uuid(), assignedAt: z.string(), order: z.object({ id: z.string().uuid(), orderCode: z.string(), recipientName: z.string(), township: z.string(), destinationCity: z.string().nullable(), status: orderStatusSchema,
  statusEvents: z.array(z.object({ id: z.string().uuid(), previousStatus: orderStatusSchema, status: orderStatusSchema, note: z.string().nullable(), createdAt: z.string() })) }) })) });
export const dashboardSchema = z.object({ list: riderListSchema, overview: riderOverviewSchema, pending: pendingInvitationsSchema });
export const managementRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), query: riderQuerySchema, invitationPage: z.number().int().min(1).default(1), invitationPageSize: z.number().int().min(1).max(100).default(10) }).strict(),
  z.object({ action: z.literal("detail"), id: z.string().uuid(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20) }).strict(),
  z.object({ action: z.literal("update"), id: z.string().uuid(), input: riderProfileUpdateRequestSchema }).strict(),
  z.object({ action: z.literal("deactivate"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("reactivate"), id: z.string().uuid() }).strict(),
]);
export type RiderQuery = z.infer<typeof riderQuerySchema>;
export type ManagedRider = z.infer<typeof managedRiderSchema>;
export type ManagedRiderUpdateInput = z.infer<typeof riderProfileUpdateRequestSchema>;
export const workloadLabels = { AVAILABLE: "No Active Tasks", HAS_ASSIGNED_TASKS: "Assigned / Waiting", DELIVERING: "Delivering" } as const;
export const operationalStatusLabels = { ACTIVE: "Active", INACTIVE: "Inactive" } as const;
