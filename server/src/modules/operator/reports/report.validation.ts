import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.");
export const reportQuerySchema = z.object({
  startDate: date,
  endDate: date,
  granularity: z.enum(["day", "week", "month"]).optional(),
}).strict();
export type ReportQuery = z.infer<typeof reportQuerySchema>;
