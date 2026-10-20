import { randomBytes } from "node:crypto";
import { AppError } from "../../lib/errors/app-error";
import type { OrderStatus } from "../../generated/prisma/enums";
import * as userService from "../users/user.service";
import * as repository from "./order.repository";
import type { CreateOrderInput, ListOrdersQuery, OrderIdentifier, UpdateOrderStatusInput } from "./order.validation";
import type { CreatedOrder, ListedOrder, OrderDetail, OrderListResult, UpdatedOrderDetail } from "./order.types";

export function generateOrderCode() {
  return `PO${randomBytes(8).toString("hex").toUpperCase()}`;
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isForeignKeyConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2003";
}

function serialize(order: Awaited<ReturnType<typeof repository.createOrder>>): CreatedOrder {
  return {
    id: order.id,
    orderCode: order.orderCode,
    ownerId: order.ownerId,
    deliveryServiceId: order.deliveryServiceId,
    recipientName: order.recipientName,
    phoneNumber: order.phoneNumber,
    township: order.township,
    deliveryAddress: order.deliveryAddress,
    parcelWeight: order.parcelWeightKg.toString(),
    parcelWeightUnit: "kg",
    codAmount: order.codAmount.toString(),
    currency: order.currency,
    senderName: order.senderName,
    deliveryInstructions: order.deliveryInstructions,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function createOrder(ownerId: string, input: CreateOrderInput): Promise<CreatedOrder> {
  await userService.getProfile(ownerId);
  const deliveryService = await repository.findDeliveryService(input.deliveryServiceId);
  if (!deliveryService?.isActive) {
    throw new AppError(404, "DELIVERY_SERVICE_UNAVAILABLE", "Delivery service is not available.");
  }
  const deliveryInstructions = input.deliveryInstructions ? input.deliveryInstructions : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await repository.createOrder({
        orderCode: generateOrderCode(),
        ownerId,
        deliveryServiceId: deliveryService.id,
        recipientName: input.recipientName,
        phoneNumber: input.phoneNumber,
        township: input.township,
        deliveryAddress: input.deliveryAddress,
        parcelWeightKg: input.parcelWeight,
        codAmount: input.codAmount,
        senderName: input.senderName,
        deliveryInstructions,
      });
      return serialize(order);
    } catch (error) {
      if (isForeignKeyConflict(error)) {
        throw new AppError(404, "DELIVERY_SERVICE_UNAVAILABLE", "Delivery service is not available.");
      }
      if (isUniqueConflict(error) && attempt < 4) continue;
      throw error;
    }
  }
  throw new AppError(409, "ORDER_CREATE_FAILED", "Unable to create the order. Try again.");
}

type OrderDetailRow = NonNullable<Awaited<ReturnType<typeof repository.findOrderForOwner>>>;
function serializeDetail(order: OrderDetailRow): OrderDetail {
  return {
    id: order.id,
    orderCode: order.orderCode,
    ownerId: order.ownerId,
    deliveryServiceId: order.deliveryServiceId,
    recipientName: order.recipientName,
    phoneNumber: order.phoneNumber,
    township: order.township,
    deliveryAddress: order.deliveryAddress,
    parcelWeight: order.parcelWeightKg.toString(),
    parcelWeightUnit: "kg",
    codAmount: order.codAmount.toString(),
    currency: order.currency,
    senderName: order.senderName,
    deliveryInstructions: order.deliveryInstructions,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    owner: order.owner,
    deliveryService: order.deliveryService,
  };
}

// Owner-scoped parcel detail. Ownership is enforced inside the lookup, so a parcel of
// another SME is reported exactly like a missing one and its existence is never revealed.
export async function getOrder(ownerId: string, identifier: OrderIdentifier): Promise<OrderDetail> {
  await userService.getProfile(ownerId);
  const order = await repository.findOrderForOwner(ownerId, identifier);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
  return serializeDetail(order);
}

// Explicit delivery workflow. Each entry lists the only statuses reachable from that
// status: forward progression, plus FAILED from any in-progress status. DELIVERED,
// FAILED and CANCELLED are terminal (empty list) and self-transitions are never allowed.
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "FAILED"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

function isTerminal(status: OrderStatus) {
  return ALLOWED_STATUS_TRANSITIONS[status].length === 0;
}

// Owner-scoped status change. Ownership comes only from the authenticated caller, the
// transition is validated against the persisted status, and the write is a conditional
// update so concurrent requests cannot overwrite a newer status.
export async function updateOrderStatus(ownerId: string, identifier: OrderIdentifier, input: UpdateOrderStatusInput): Promise<UpdatedOrderDetail> {
  await userService.getProfile(ownerId);
  const current = await repository.findOrderForOwner(ownerId, identifier);
  if (!current) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
  const previousStatus = current.status;
  if (isTerminal(previousStatus)) {
    throw new AppError(409, "ORDER_IS_TERMINAL", "The parcel has reached a final status and can no longer be changed.");
  }
  if (!ALLOWED_STATUS_TRANSITIONS[previousStatus].includes(input.status)) {
    throw new AppError(409, "STATUS_TRANSITION_NOT_ALLOWED", "That status change is not allowed from the parcel's current status.");
  }
  const updated = await repository.updateOrderStatus({
    orderId: current.id,
    ownerId,
    previousStatus,
    status: input.status,
    actorId: ownerId,
    note: input.note ? input.note : null,
  });
  if (!updated) {
    // The compare-and-swap guard failed: the parcel vanished or its status moved first.
    const refreshed = await repository.findOrderForOwner(ownerId, identifier);
    if (!refreshed) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
    throw new AppError(409, "STATUS_UPDATE_CONFLICT", "The parcel status was changed by another request. Refresh and try again.");
  }
  return { ...serializeDetail(updated), previousStatus };
}

type ListedOrderRow = Awaited<ReturnType<typeof repository.listOrders>>[number];
function serializeListed(order: ListedOrderRow): ListedOrder {
  return {
    id: order.id,
    orderCode: order.orderCode,
    recipientName: order.recipientName,
    phoneNumber: order.phoneNumber,
    township: order.township,
    deliveryAddress: order.deliveryAddress,
    parcelWeight: order.parcelWeightKg.toString(),
    parcelWeightUnit: "kg",
    codAmount: order.codAmount.toString(),
    currency: order.currency,
    senderName: order.senderName,
    status: order.status,
    createdAt: order.createdAt,
    deliveryService: order.deliveryService,
  };
}

// Owner-scoped parcel list. Ownership always comes from the authenticated caller, never the query.
export async function listOrders(ownerId: string, query: ListOrdersQuery): Promise<OrderListResult> {
  await userService.getProfile(ownerId);
  const skip = (query.page - 1) * query.pageSize;
  const filters = { ownerId, search: query.search, status: query.status };
  const [rows, total] = await repository.listOrdersWithCount({ ...filters, skip, take: query.pageSize });
  return {
    orders: rows.map(serializeListed),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
}
