import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import type { OrderStatus } from "../../generated/prisma/enums";
import type { OrderIdentifier } from "./order.validation";

// One projection shared by the detail read and the status-update read so both
// serialize to exactly the same shape.
const orderDetailSelect = {
  id: true,
  orderCode: true,
  ownerId: true,
  deliveryServiceId: true,
  recipientName: true,
  phoneNumber: true,
  township: true,
  deliveryAddress: true,
  parcelWeightKg: true,
  codAmount: true,
  currency: true,
  senderName: true,
  deliveryInstructions: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, fullName: true, phone: true } },
  deliveryService: { select: { id: true, name: true, isActive: true } },
} as const satisfies Prisma.ParcelOrderSelect;

export type OrderCreateRecord = {
  orderCode: string;
  qrIdentifier: string;
  ownerId: string;
  deliveryServiceId: string;
  recipientName: string;
  phoneNumber: string;
  township: string;
  deliveryAddress: string;
  parcelWeightKg: number;
  codAmount: string;
  senderName: string;
  deliveryInstructions: string | null;
};

export type OrderListFilters = {
  ownerId: string;
  search?: string;
  status?: "CREATED";
  skip: number;
  take: number;
};

// Shared by list and count so both always use identical filters.
function buildWhere(filters: Pick<OrderListFilters, "ownerId" | "search" | "status">): Prisma.ParcelOrderWhereInput {
  const where: Prisma.ParcelOrderWhereInput = { ownerId: filters.ownerId };
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { orderCode: { contains: filters.search, mode: "insensitive" } },
      { recipientName: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export function listOrders(filters: OrderListFilters) {
  return prisma.parcelOrder.findMany({
    where: buildWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: filters.skip,
    take: filters.take,
    select: {
      id: true,
      orderCode: true,
      recipientName: true,
      phoneNumber: true,
      township: true,
      deliveryAddress: true,
      parcelWeightKg: true,
      codAmount: true,
      currency: true,
      senderName: true,
      status: true,
      createdAt: true,
      deliveryService: { select: { id: true, name: true } },
    },
  });
}

export function countOrders(filters: Pick<OrderListFilters, "ownerId" | "search" | "status">) {
  return prisma.parcelOrder.count({ where: buildWhere(filters) });
}

// Runs the page query and the matching count in one transaction so both share a consistent snapshot.
export function listOrdersWithCount(filters: OrderListFilters) {
  return prisma.$transaction([
    listOrders(filters),
    countOrders(filters),
  ]);
}

// Ownership is part of the WHERE clause, so another SME's parcel simply does not match.
export function findOrderForOwner(ownerId: string, identifier: OrderIdentifier) {
  const matches = identifier.kind === "id" ? { id: identifier.value } : { orderCode: identifier.value };
  return prisma.parcelOrder.findFirst({
    where: { ownerId, ...matches },
    select: orderDetailSelect,
  });
}

export function findOrderQrForOwner(ownerId: string, identifier: OrderIdentifier) {
  const matches = identifier.kind === "id" ? { id: identifier.value } : { orderCode: identifier.value };
  return prisma.parcelOrder.findFirst({
    where: { ownerId, ...matches },
    select: { id: true, orderCode: true, qrIdentifier: true },
  });
}

export type OrderStatusUpdateRecord = {
  orderId: string;
  ownerId: string;
  previousStatus: OrderStatus;
  status: OrderStatus;
  actorId: string;
  note: string | null;
};

// Compare-and-swap on the status: the update only applies while the row still belongs to
// the owner and still has the status the transition was validated against, so a stale or
// concurrent request can never silently overwrite a newer status. The history row is
// written in the same transaction as the status change. Returns null when the guard failed.
export function updateOrderStatus(data: OrderStatusUpdateRecord) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.parcelOrder.updateMany({
      where: { id: data.orderId, ownerId: data.ownerId, status: data.previousStatus },
      data: { status: data.status },
    });
    if (updated.count === 0) return null;
    await tx.orderStatusEvent.create({
      data: {
        orderId: data.orderId,
        actorId: data.actorId,
        previousStatus: data.previousStatus,
        status: data.status,
        note: data.note,
      },
    });
    return tx.parcelOrder.findFirst({
      where: { id: data.orderId, ownerId: data.ownerId },
      select: orderDetailSelect,
    });
  });
}

export function findDeliveryService(id: string) {
  return prisma.deliveryService.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });
}

export function createOrder(data: OrderCreateRecord) {
  return prisma.parcelOrder.create({
    data: {
      orderCode: data.orderCode,
      qrIdentifier: data.qrIdentifier,
      ownerId: data.ownerId,
      deliveryServiceId: data.deliveryServiceId,
      recipientName: data.recipientName,
      phoneNumber: data.phoneNumber,
      township: data.township,
      deliveryAddress: data.deliveryAddress,
      parcelWeightKg: new Prisma.Decimal(data.parcelWeightKg.toString()),
      codAmount: new Prisma.Decimal(data.codAmount),
      senderName: data.senderName,
      deliveryInstructions: data.deliveryInstructions,
    },
  });
}
