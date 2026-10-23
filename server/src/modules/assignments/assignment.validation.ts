import { z } from "zod";
import { OrderStatus } from "../../generated/prisma/enums";

export const assignmentIdSchema = z.string().uuid();
const qrIdentifier = /^[a-f0-9]{64}$/i;
const orderCode = /^PO[0-9A-F]{16}$/i;
export const parcelScanSchema = z.object({
  qrData: z.string().trim().min(1).max(512).refine(value => qrIdentifier.test(value) || orderCode.test(value), "Unsupported parcel QR or code."),
}).strict();
export const activeAssignmentStatuses = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] as const;
export const completedAssignmentStatuses = ["DELIVERED", "FAILED", "CANCELLED"] as const;
export const assignmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
// Rider list tab/filter query. group and status are optional so existing
// unfiltered callers keep their current behaviour.
export const riderAssignmentQuerySchema = assignmentQuerySchema.extend({
  group: z.enum(["active", "completed"]).optional(),
  status: z.enum(OrderStatus).optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.group || !value.status) return;
  const allowed = value.group === "active" ? activeAssignmentStatuses : completedAssignmentStatuses;
  if (!(allowed as readonly OrderStatus[]).includes(value.status)) {
    ctx.addIssue({ code: "custom", path: ["status"], message: `Status ${value.status} is not valid for ${value.group} deliveries.` });
  }
});
export const createAssignmentSchema = z.object({ orderId: z.string().uuid(), riderId: z.string().uuid() }).strict();
export const deliveryStatusSchema = z.object({
  status: z.enum(OrderStatus).refine(status => ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(status), "Unsupported Rider status"),
  note: z.string().trim().min(1).max(1000).optional(),
}).strict().refine(value => value.status !== "FAILED" || (value.note?.length ?? 0) >= 3, { path: ["note"], message: "Failure requires a reason of at least 3 characters" });
export type AssignmentQuery = z.infer<typeof assignmentQuerySchema>;
export type RiderAssignmentQuery = z.infer<typeof riderAssignmentQuerySchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type DeliveryStatusInput = z.infer<typeof deliveryStatusSchema>;
export type ParcelScanInput = z.infer<typeof parcelScanSchema>;
