import { z } from "zod";

export const orderStatuses = ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"] as const;
export const operatorOrdersQuerySchema = z.object({
  unassigned: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(orderStatuses).optional(),
  township: z.string().trim().min(1).max(120).optional(),
  createdDate: z.iso.date().optional(),
}).strict();
export type OperatorOrdersQuery = z.infer<typeof operatorOrdersQuerySchema>;
export const parcelFilterSchema = z.object({
  search: z.string().trim().max(120),
  status: z.union([z.enum(orderStatuses), z.literal("")]),
  township: z.string().trim().max(120),
  createdDate: z.union([z.iso.date(), z.literal("")]),
});
export type ParcelFilters = z.infer<typeof parcelFilterSchema>;
const personSchema = z.object({ id: z.string().uuid(), fullName: z.string().nullable() });
const decimal = z.string().regex(/^\d+(?:\.\d+)?$/);
export const operatorOrderSchema = z.object({
  id: z.string().uuid(), orderCode: z.string(), ownerId: z.string().uuid(),
  recipientName: z.string(), phoneNumber: z.string(), township: z.string(), deliveryAddress: z.string(),
  senderName: z.string(), parcelWeight: decimal, parcelWeightUnit: z.literal("kg"),
  codAmount: decimal, currency: z.string(), status: z.string(),
  hasIncident: z.boolean(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), deliveryInstructions: z.string().nullable(),
  owner: personSchema.extend({ phone: z.string().nullable() }),
  operatorId: z.string().uuid().nullable(),
  operator: personSchema.extend({ phone: z.string().nullable() }).nullable(),
});
export const operatorOrderDetailSchema = operatorOrderSchema.extend({
  warehouseState: z.enum(["UNASSIGNED", "ASSIGNED", "DISPATCHED", "COMPLETED", "EXCEPTION"]).nullable().optional(),
  receipt: z.object({ receivedAt: z.iso.datetime(), receivedBy: personSchema }).nullable().optional(),
  failureNote: z.string().nullable().optional(),
  assignment: z.object({ id: z.string().uuid(), riderId: z.string().uuid(), assignedById: z.string().uuid(), assignedAt: z.iso.datetime(),
    rider: personSchema.extend({ phone: z.string().nullable() }), }).nullable().optional(),
  statusEvents: z.array(z.object({ id: z.string().uuid(), previousStatus: z.string(), status: z.string(),
    note: z.string().nullable(), createdAt: z.iso.datetime(), actor: personSchema })),
});
export const operatorOrderListSchema = z.object({
  orders: z.array(operatorOrderSchema), pagination: z.object({
    page: z.number().int().positive(), pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative(),
  }),
});
export type OperatorOrder = z.infer<typeof operatorOrderSchema>;
export type OperatorOrderDetail = z.infer<typeof operatorOrderDetailSchema>;
export const receivedOperatorOrderSchema = operatorOrderDetailSchema.extend({ previousStatus: z.literal("CREATED") });
export type OperatorOrderList = z.infer<typeof operatorOrderListSchema>;

export function ordersSearchParams(query: OperatorOrdersQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  return params;
}
