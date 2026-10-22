import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { AppError } from "../../lib/errors/app-error";
import { OrderStatus } from "../../generated/prisma/enums";
import * as userService from "../users/user.service";
import * as repository from "./order.repository";
import type { CreateOrderInput, ListOrdersQuery, OrderIdentifier, UpdateOrderStatusInput } from "./order.validation";
import type { CreatedOrder, DashboardPeriod, DashboardRecentOrder, DashboardTimelineEntry, ListedOrder, OrderDashboard, OrderDetail, OrderListResult, OrderQr, UpdatedOrderDetail } from "./order.types";

export function generateOrderCode() {
  return `PO${randomBytes(8).toString("hex").toUpperCase()}`;
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function isForeignKeyConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2003";
}

async function generateQrImageDataUrl(identifier: string): Promise<string> {
  try {
    return await QRCode.toDataURL(identifier, { errorCorrectionLevel: "M", type: "image/png" });
  } catch {
    throw new AppError(500, "QR_GENERATION_FAILED", "Unable to generate the parcel QR code.");
  }
}

function serialize(order: Awaited<ReturnType<typeof repository.createOrder>>, operatorId: string, qrImageDataUrl: string): CreatedOrder {
  return {
    id: order.id,
    orderCode: order.orderCode,
    ownerId: order.ownerId,
    operatorId,
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
    qr: { identifier: order.qrIdentifier, imageDataUrl: qrImageDataUrl },
  };
}

export async function createOrder(ownerId: string, input: CreateOrderInput): Promise<CreatedOrder> {
  await userService.getProfile(ownerId);
  const operator = await repository.findOperator(input.operatorId);
  if (!operator) {
    throw new AppError(404, "OPERATOR_NOT_AVAILABLE", "Operator is not available.");
  }
  const deliveryInstructions = input.deliveryInstructions ? input.deliveryInstructions : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const qrIdentifier = randomBytes(32).toString("hex");
    const qrImageDataUrl = await generateQrImageDataUrl(qrIdentifier);
    try {
      const order = await repository.createOrder({
        orderCode: generateOrderCode(),
        qrIdentifier,
        ownerId,
        operatorId: operator.id,
        recipientName: input.recipientName,
        phoneNumber: input.phoneNumber,
        township: input.township,
        deliveryAddress: input.deliveryAddress,
        parcelWeightKg: input.parcelWeight,
        codAmount: input.codAmount,
        senderName: input.senderName,
        deliveryInstructions,
      });
      return serialize(order, operator.id, qrImageDataUrl);
    } catch (error) {
      if (isForeignKeyConflict(error)) {
        throw new AppError(404, "OPERATOR_NOT_AVAILABLE", "Operator is not available.");
      }
      if (isUniqueConflict(error)) {
        if (attempt < 4) continue;
        throw new AppError(409, "ORDER_CREATE_FAILED", "Unable to create the order. Try again.");
      }
      throw error;
    }
  }
  throw new AppError(409, "ORDER_CREATE_FAILED", "Unable to create the order. Try again.");
}

export async function getOrderQr(ownerId: string, identifier: OrderIdentifier): Promise<OrderQr> {
  await userService.getProfile(ownerId);
  const order = await repository.findOrderQrForOwner(ownerId, identifier);
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
  if (!/^[a-f0-9]{64}$/.test(order.qrIdentifier)) {
    throw new AppError(500, "QR_CODE_UNAVAILABLE", "The parcel QR code is unavailable.");
  }
  return {
    id: order.id,
    orderCode: order.orderCode,
    qr: {
      identifier: order.qrIdentifier,
      imageDataUrl: await generateQrImageDataUrl(order.qrIdentifier),
    },
  };
}

type OrderDetailRow = NonNullable<Awaited<ReturnType<typeof repository.findOrderForOwner>>>;
function serializeDetail(order: OrderDetailRow): OrderDetail {
  return {
    id: order.id,
    orderCode: order.orderCode,
    ownerId: order.ownerId,
    operatorId: order.operatorId,
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
    operator: order.operator,
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

// SME owners may only cancel CREATED parcels. Operational delivery transitions
// belong exclusively to Operator receipt and assigned Rider delivery workflows.
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: ["CANCELLED"],
  PICKED_UP: [],
  IN_TRANSIT: [],
  OUT_FOR_DELIVERY: [],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

function isTerminal(status: OrderStatus) {
  return ["DELIVERED", "FAILED", "CANCELLED"].includes(status);
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
    operatorId: order.operatorId,
    operator: order.operator,
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

function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function calculateSuccessRate(totalShipments: number, totalDelivered: number) {
  return totalShipments === 0 ? 0 : Math.round((totalDelivered / totalShipments) * 10000) / 100;
}

type DashboardRows = Awaited<ReturnType<typeof repository.getDashboardData>>;

function serializeDashboardRecentOrder(order: DashboardRows[6][number], imageDataUrl: string): DashboardRecentOrder {
  const trackingTimeline: DashboardTimelineEntry[] = [
    {
      status: OrderStatus.CREATED,
      previousStatus: null,
      note: null,
      createdAt: order.createdAt,
      actor: order.owner,
    },
    ...order.statusEvents,
  ];

  return {
    id: order.id,
    orderCode: order.orderCode,
    recipient: {
      name: order.recipientName,
      phoneNumber: order.phoneNumber,
      township: order.township,
      deliveryAddress: order.deliveryAddress,
    },
    parcel: {
      weight: order.parcelWeightKg.toString(),
      weightUnit: "kg",
      codAmount: order.codAmount.toString(),
      currency: order.currency,
      deliveryInstructions: order.deliveryInstructions,
    },
    status: order.status,
    createdAt: order.createdAt,
    trackingTimeline,
    qr: { identifier: order.qrIdentifier, imageDataUrl },
    operator: order.operator,
    deliveryRider: null,
  };
}

export async function getOrderDashboard(ownerId: string): Promise<OrderDashboard> {
  await userService.getProfile(ownerId);
  const now = new Date();
  const weekStart = startOfUtcWeek(now);
  const monthStart = startOfUtcMonth(now);
  const [totalParcels, groupedStatuses, weekShipments, weekDelivered, monthShipments, monthDelivered, recentRows] =
    await repository.getDashboardData(ownerId, weekStart, monthStart, now);

  const statusCounts = Object.fromEntries(Object.values(OrderStatus).map((status) => [status, 0])) as Record<OrderStatus, number>;
  for (const group of groupedStatuses) {
    statusCounts[group.status] = typeof group._count === "object" && group._count !== null ? group._count._all ?? 0 : 0;
  }

  const period = (startsAt: Date, totalShipments: number, totalDelivered: number): DashboardPeriod => ({
    startsAt,
    endsAt: now,
    totalShipments,
    totalDelivered,
    successRate: calculateSuccessRate(totalShipments, totalDelivered),
  });

  const recentOrders = await Promise.all(recentRows.map(async (order) => {
    const imageDataUrl = await generateQrImageDataUrl(order.qrIdentifier);
    return serializeDashboardRecentOrder(order, imageDataUrl);
  }));

  return {
    totalParcels,
    statusCounts,
    deliveryOverview: {
      thisWeek: period(weekStart, weekShipments, weekDelivered),
      thisMonth: period(monthStart, monthShipments, monthDelivered),
    },
    recentOrders,
  };
}
