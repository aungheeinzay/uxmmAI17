import { z } from "zod";
export const deliveryQuerySchema = z.object({ page: z.number().int().min(1).max(1000000).default(1), pageSize: z.number().int().min(1).max(100).default(20) }).strict();
export type DeliveryQuery = z.infer<typeof deliveryQuerySchema>;
const person = z.object({ id: z.string().uuid(), fullName: z.string().nullable(), phone: z.string().nullable() });
const pagination = z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() });
export const assignmentSchema = z.object({
  id: z.string().uuid(), orderId: z.string().uuid(), riderId: z.string().uuid(), assignedById: z.string().uuid(), assignedAt: z.iso.datetime(),
  rider: person, assignedBy: person,
  order: z.object({ id: z.string().uuid(), orderCode: z.string(), recipientName: z.string(), phoneNumber: z.string(),
    deliveryAddress: z.string(), township: z.string(), deliveryInstructions: z.string().nullable(),
    codAmount: z.string().regex(/^\d+(?:\.\d+)?$/), currency: z.string(), status: z.string() }),
});
export const assignmentDetailSchema = assignmentSchema.extend({ order: assignmentSchema.shape.order.extend({
  statusEvents: z.array(z.object({ id: z.string().uuid(), previousStatus: z.string(), status: z.string(), note: z.string().nullable(), createdAt: z.iso.datetime(), actor: z.object({ id: z.string().uuid(), fullName: z.string().nullable() }) })),
}) });
export const assignmentListSchema = z.object({ assignments: z.array(assignmentSchema), pagination });
export const eligibleRidersSchema = z.object({ riders: z.array(person), pagination });
export const createAssignmentSchema = z.object({ orderId: z.string().uuid(), riderId: z.string().uuid() }).strict();
export const deliveryStatusSchema = z.object({ status: z.enum(["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"]), note: z.string().trim().min(1).max(1000).optional() }).strict().refine(value => value.status !== "FAILED" || (value.note?.length ?? 0) >= 3, { path: ["note"], message: "Enter a failure reason of at least 3 characters." });
export const statusRequestSchema = z.object({ id: z.string().uuid(), ...deliveryStatusSchema.shape }).strict().refine(value => value.status !== "FAILED" || (value.note?.length ?? 0) >= 3, { path: ["note"], message: "Enter a failure reason of at least 3 characters." });
export type Assignment = z.infer<typeof assignmentSchema>;
export type AssignmentDetail = z.infer<typeof assignmentDetailSchema>;
export type DeliveryStatusInput = z.infer<typeof deliveryStatusSchema>;
export const riderActions: Record<string, DeliveryStatusInput["status"][]> = { PICKED_UP: ["IN_TRANSIT"], IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED"], OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"] };
