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
  operatorId: true,
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
  operator: { select: { id: true, fullName: true, phone: true } },
} as const satisfies Prisma.ParcelOrderSelect;

export type OrderCreateRecord = {
  orderCode: string;
  qrIdentifier: string;
  operatorId: string;
  ownerId: string;
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
      operatorId: true,
      operator: { select: { id: true, fullName: true } },
    },
  });
}

export function countOrders(filters: Pick<OrderListFilters, "ownerId" | "search" | "status">) {
  return prisma.parcelOrder.count({ where: buildWhere(filters) });
}

export function getDashboardData(ownerId: string, weekStart: Date, monthStart: Date, now: Date) {
  const weekWhere = { ownerId, createdAt: { gte: weekStart, lt: now } };
  const monthWhere = { ownerId, createdAt: { gte: monthStart, lt: now } };
  return prisma.$transaction([
    prisma.parcelOrder.count({ where: { ownerId } }),
    prisma.parcelOrder.groupBy({ by: ["status"], where: { ownerId }, orderBy: { status: "asc" }, _count: { _all: true } }),
    prisma.parcelOrder.count({ where: weekWhere }),
    prisma.parcelOrder.count({ where: { ...weekWhere, status: "DELIVERED" } }),
    prisma.parcelOrder.count({ where: monthWhere }),
    prisma.parcelOrder.count({ where: { ...monthWhere, status: "DELIVERED" } }),
    prisma.parcelOrder.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
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
        deliveryInstructions: true,
        qrIdentifier: true,
        status: true,
        createdAt: true,
        owner: { select: { id: true, fullName: true, role: true } },
        operator: { select: { id: true, fullName: true, phone: true } },
        statusEvents: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            status: true,
            previousStatus: true,
            note: true,
            createdAt: true,
            actor: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    }),
  ]);
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

export function findOperator(id: string) {
  return prisma.profile.findFirst({
    where: { id, role: "OPERATOR" },
    select: { id: true },
  });
}

export function createOrder(data: OrderCreateRecord) {
  return prisma.parcelOrder.create({
    data: {
      orderCode: data.orderCode,
      qrIdentifier: data.qrIdentifier,
      operatorId: data.operatorId,
      ownerId: data.ownerId,
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
