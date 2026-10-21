import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { operatorOrderDetailSchema, operatorOrderListSchema, operatorOrdersQuerySchema, type OperatorOrdersQuery } from "../types/operator-order.types";

export async function getOperatorOrders(query: OperatorOrdersQuery) {
  const payload = await postSessionJson("operator/orders", operatorOrdersQuerySchema.parse(query));
  const result = z.object({ success: z.literal(true), data: operatorOrderListSchema }).safeParse(payload);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
export async function getOperatorOrder(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, "VALIDATION_ERROR");
  const payload = await postSessionJson("operator/orders/detail", { id });
  const result = z.object({ success: z.literal(true), data: operatorOrderDetailSchema }).safeParse(payload);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
export function operatorOrdersError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign in again to continue.";
    if (error.status === 403) return "You do not have permission to view Operator parcels.";
    if (error.status === 404) return "Parcel not found.";
    if (error.status === 400) return "Check the parcel identifier and filters, then try again.";
  }
  return "We could not load parcels. Check your connection and try again.";
}
