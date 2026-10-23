import { z } from "zod";

export const reportQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granularity: z.enum(["day", "week", "month"]).optional(),
});
const statuses = ["CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"] as const;
export const reportOverviewSchema = z.object({
  period: z.object({ start: z.string(), end: z.string(), timezone: z.string() }),
  metrics: z.object({ totalParcels: z.number(), delivered: z.number(), failed: z.number(), successRate: z.number().nullable(), averageDeliveryHours: z.number().nullable() }),
  volume: z.array(z.object({ date: z.string(), count: z.number() })),
  statusBreakdown: z.array(z.object({ status: z.enum(statuses), count: z.number() })),
  granularity: z.enum(["day", "week", "month"]),
  unavailableMetrics: z.object({ averageDeliveryHours: z.string().nullable() }),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ReportOverview = z.infer<typeof reportOverviewSchema>;
