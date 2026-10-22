import { z } from "zod";
import { orderStatusSchema } from "./order-list.schema";

const statusTimelineEntrySchema = z.object({
  status: orderStatusSchema,
  previousStatus: orderStatusSchema.nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const orderStatusResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().uuid(),
    orderCode: z.string(),
    status: orderStatusSchema,
    timeline: z.array(statusTimelineEntrySchema),
  }),
});

export type OrderStatusView = z.infer<typeof orderStatusResponseSchema>["data"];
export type StatusTimelineEntry = z.infer<typeof statusTimelineEntrySchema>;
