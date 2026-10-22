import { z } from "zod";

export const deliveryServiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string(),
  fee: z.string(),
  currency: z.literal("MMK"),
});

export const deliveryServicesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    city: z.string(),
    services: z.array(deliveryServiceSchema),
  }),
});

export const deliveryCitiesResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    cities: z.array(z.string()),
  }),
});

export type DeliveryService = z.infer<typeof deliveryServiceSchema>;
export type DeliveryServicesData = z.infer<typeof deliveryServicesResponseSchema>["data"];
export type DeliveryCitiesData = z.infer<typeof deliveryCitiesResponseSchema>["data"];
