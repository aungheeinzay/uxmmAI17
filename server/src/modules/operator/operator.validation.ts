import { z } from "zod";
import { OrderStatus } from "../../generated/prisma/enums";

export const operatorOrderIdSchema = z.string().uuid();
export const receiveParcelSchema = z.object({
  note: z.string().trim().max(1000).nullable().optional(),
}).strict();
export type ReceiveParcelInput = z.infer<typeof receiveParcelSchema>;
export const operatorOrdersQuerySchema = z.object({
  unassigned: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  township: z.string().trim().min(1).max(120).optional(),
  status: z.enum(OrderStatus).optional(),
  createdDate: z.iso.date().optional(),
}).strict();
export type OperatorOrdersQuery = z.infer<typeof operatorOrdersQuerySchema>;
