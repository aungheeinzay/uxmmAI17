import { ApiError, getSessionJson } from "@/lib/api-client";
import { orderDetailResponseSchema, orderQrResponseSchema, type OrderDetail, type OrderQr } from "../schemas/order-detail.schema";
import { orderListResponseSchema, type OrderList, type OrderStatus, type OrderTab } from "../schemas/order-list.schema";
import { orderStatusResponseSchema, type OrderStatusView } from "../schemas/order-status.schema";

export type OrderListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrderStatus;
  tab: OrderTab;
};

export async function getOrders(query: OrderListQuery): Promise<OrderList> {
  const result = orderListResponseSchema.safeParse(
    await getSessionJson("orders", {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search?.trim() || undefined,
      status: query.status,
      tab: query.tab,
    }),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}

// Reads the parcel status view for a parcel id or order code. The identifier is validated by
// the backend, which also enforces that the parcel belongs to the authenticated SME.
export async function getOrderStatus(identifier: string): Promise<OrderStatusView> {
  const result = orderStatusResponseSchema.safeParse(
    await getSessionJson(`orders/${encodeURIComponent(identifier.trim())}/status`),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}

export async function getOrderDetail(identifier: string): Promise<OrderDetail> {
  const result = orderDetailResponseSchema.safeParse(
    await getSessionJson(`orders/${encodeURIComponent(identifier.trim())}`),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}

export async function getOrderQr(identifier: string): Promise<OrderQr> {
  const result = orderQrResponseSchema.safeParse(
    await getSessionJson(`orders/${encodeURIComponent(identifier.trim())}/qr`),
  );
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
