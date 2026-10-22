import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import type { OrderStatus } from "../../generated/prisma/enums";
import type { OrderIdentifier } from "./order.validation";
import { pricingSelect } from "../providers/order-pricing";

// One projection shared by the detail read and the status-update read so both
// serialize to exactly the same shape.
const orderDetailSelect = {
  ...pricingSelect,
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
  destinationCity: string;
  deliveryProviderId: string;
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
  statuses?: readonly OrderStatus[];
  skip: number;
  take: number;
};

// Shared by list and count so both always use identical filters.
function buildWhere(filters: Pick<OrderListFilters, "ownerId" | "search" | "statuses">): Prisma.ParcelOrderWhereInput {
  const where: Prisma.ParcelOrderWhereInput = { ownerId: filters.ownerId };
  if (filters.statuses && filters.statuses.length > 0) where.status = { in: [...filters.statuses] };
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
      ...pricingSelect,
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

export function countOrders(filters: Pick<OrderListFilters, "ownerId" | "search" | "statuses">) {
  return prisma.parcelOrder.count({ where: buildWhere(filters) });
}

// Owner-scoped status tally, ignoring search and page so the tab counts reflect the whole book of parcels.
export function countOrdersByStatus(ownerId: string) {
  return prisma.parcelOrder.groupBy({
    by: ["status"],
    where: { ownerId },
    orderBy: { status: "asc" },
    _count: { _all: true },
  });
}

// One calendar month (UTC) used to group the SME's monthly totals.
export type DashboardMonthRange = {
  /** Calendar month in UTC, for example "2026-10". */
  month: string;
  startsAt: Date;
  endsAt: Date;
};

// Monthly cash-on-delivery totals per month. Ownership is part of the WHERE clause, so a
// parcel of another SME never contributes. Months without parcels report zero.
export function getMonthlyDeliveryTotals(ownerId: string, monthRanges: readonly DashboardMonthRange[]) {
  return prisma.$transaction(
    monthRanges.map((range) =>
      prisma.parcelOrder.aggregate({
        where: { ownerId, createdAt: { gte: range.startsAt, lt: range.endsAt } },
        _sum: { deliveryFee: true },
        _count: { _all: true },
      }),
    ),
  );
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
        ...pricingSelect,
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

// Runs the page query, the matching count and the status tally in one transaction so all share a consistent snapshot.
export function listOrdersWithCount(filters: OrderListFilters) {
  return prisma.$transaction([
    listOrders(filters),
    countOrders(filters),
    countOrdersByStatus(filters.ownerId),
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

// Status-only read scoped to the owner. Selects no recipient, address or financial data.
export function findStatusByIdentifier(ownerId: string, identifier: OrderIdentifier) {
  const matches = identifier.kind === "id" ? { id: identifier.value } : { orderCode: identifier.value };
  return prisma.parcelOrder.findFirst({
    where: { ownerId, ...matches },
    select: {
      id: true,
      orderCode: true,
      status: true,
      createdAt: true,
      statusEvents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { status: true, previousStatus: true, note: true, createdAt: true },
      },
    },
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

export function findOperator(id: string, providerId: string) {
  return prisma.profile.findFirst({
    where: { id, role: "OPERATOR", providerId },
    select: { id: true },
  });
}

export function findOperatorForProvider(providerId: string) {
  return prisma.profile.findFirst({
    where: { role: "OPERATOR", providerId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
}

export function createOrder(data: OrderCreateRecord, validatePrice: (price: { fee: Prisma.Decimal; provider: { isActive: boolean } } | null) => Prisma.Decimal) {
  return prisma.$transaction(async tx => {
    const price = await tx.deliveryCityPrice.findFirst({
      where: { providerId: data.deliveryProviderId, city: data.destinationCity, isActive: true },
      select: { fee: true, provider: { select: { isActive: true } } },
    });
    const deliveryFee = validatePrice(price);
    return tx.parcelOrder.create({
      data: {
        destinationCity: data.destinationCity,
        deliveryProviderId: data.deliveryProviderId,
        deliveryFee,
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
      include: { deliveryProvider: { select: { id: true, name: true } } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
