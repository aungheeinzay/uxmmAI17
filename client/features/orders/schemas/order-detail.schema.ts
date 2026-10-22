import { z } from "zod";
import { orderStatusSchema } from "./order-list.schema";

const profileSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
});

export const orderDetailResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    destinationCity: z.string().nullable(),
    deliveryProviderId: z.string().uuid().nullable(),
    deliveryProvider: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
    deliveryFee: z.string().nullable(),
    id: z.string().uuid(),
    orderCode: z.string(),
    ownerId: z.string().uuid(),
    operatorId: z.string().uuid().nullable(),
    recipientName: z.string(),
    phoneNumber: z.string(),
    township: z.string(),
    deliveryAddress: z.string(),
    parcelWeight: z.string(),
    parcelWeightUnit: z.literal("kg"),
    codAmount: z.string(),
    currency: z.string(),
    senderName: z.string(),
    deliveryInstructions: z.string().nullable(),
    status: orderStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    owner: profileSchema,
    operator: profileSchema.nullable(),
  }),
});

export const orderQrResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().uuid(),
    orderCode: z.string(),
    qr: z.object({
      identifier: z.string().regex(/^[a-f0-9]{64}$/),
      imageDataUrl: z.string().startsWith("data:image/png;base64,"),
    }),
  }),
});

export type OrderDetail = z.infer<typeof orderDetailResponseSchema>["data"];
export type OrderQr = z.infer<typeof orderQrResponseSchema>["data"];
