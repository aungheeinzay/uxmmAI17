import { z } from "zod";

export const orderStatusSchema = z.enum([
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
]);

export const orderTabSchema = z.enum(["all", "needs_pickup", "exceptions"]);

const listedOrderSchema = z.object({
  destinationCity: z.string().nullable(),
  deliveryProviderId: z.string().uuid().nullable(),
  deliveryProvider: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  deliveryFee: z.string().nullable(),
  id: z.string().uuid(),
  orderCode: z.string(),
  recipientName: z.string(),
  phoneNumber: z.string(),
  township: z.string(),
  deliveryAddress: z.string(),
  parcelWeight: z.string(),
  parcelWeightUnit: z.literal("kg"),
  codAmount: z.string(),
  currency: z.string(),
  senderName: z.string(),
  status: orderStatusSchema,
  createdAt: z.string().datetime(),
  operatorId: z.string().uuid().nullable(),
  operator: z.object({
    id: z.string().uuid(),
    fullName: z.string().nullable(),
  }).nullable(),
});

export const orderListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    orders: z.array(listedOrderSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
    tabCounts: z.object({
      all: z.number().int().nonnegative(),
      needsPickup: z.number().int().nonnegative(),
      exceptions: z.number().int().nonnegative(),
    }),
  }),
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderTab = z.infer<typeof orderTabSchema>;
export type ListedOrder = z.infer<typeof listedOrderSchema>;
export type OrderList = z.infer<typeof orderListResponseSchema>["data"];
