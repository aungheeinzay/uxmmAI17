import { prisma } from "../../config/prisma";
import { pricingSelect } from "../providers/order-pricing";
import { Prisma } from "../../generated/prisma/client";
import type { OperatorOrdersQuery } from "./operator.validation";
import type { ReceiveParcelRecord } from "./operator.types";

export const orderSelect = {
  ...pricingSelect,
  id: true, orderCode: true, ownerId: true, operatorId: true, recipientName: true,
  phoneNumber: true, township: true, deliveryAddress: true, senderName: true,
  parcelWeightKg: true, codAmount: true, currency: true, status: true,
  createdAt: true, updatedAt: true, deliveryInstructions: true,
  // Derived incident flag; never a stored boolean.
  incidents: { select: { id: true }, take: 1 },
  owner: { select: { id: true, fullName: true, phone: true } },
  operator: { select: { id: true, fullName: true, phone: true } },
} as const satisfies Prisma.ParcelOrderSelect;

export function buildWhere(query: OperatorOrdersQuery): Prisma.ParcelOrderWhereInput {
  const where: Prisma.ParcelOrderWhereInput = { owner: { role: "SME" } };
  if (query.unassigned === "true") where.assignment = { is: null };
  if (query.unassigned === "false") where.assignment = { isNot: null };
  if (query.status) where.status = query.status;
  if (query.township) where.township = { equals: query.township, mode: "insensitive" };
  if (query.search) where.OR = [
    { orderCode: { contains: query.search, mode: "insensitive" } },
    { recipientName: { contains: query.search, mode: "insensitive" } },
  ];
  if (query.createdDate) {
    const start = new Date(`${query.createdDate}T00:00:00.000Z`);
    where.createdAt = { gte: start, lt: new Date(start.getTime() + 86400000) };
  }
  return where;
}

export function listWithCount(query: OperatorOrdersQuery) {
  const where = buildWhere(query);
  return prisma.$transaction([
    prisma.parcelOrder.findMany({ where, select: orderSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.parcelOrder.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

const orderDetailSelect = { ...orderSelect, assignment: { select: {
  id: true, riderId: true, assignedById: true, assignedAt: true,
  rider: { select: { id: true, fullName: true, phone: true } },
} }, statusEvents: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, previousStatus: true, status: true, note: true,
        createdAt: true, actor: { select: { id: true, fullName: true } } },
    } } as const satisfies Prisma.ParcelOrderSelect;

export function findOrder(id: string) {
  return prisma.parcelOrder.findFirst({
    where: { id, owner: { role: "SME" } }, select: orderDetailSelect,
  });
}

// Compare-and-swap against the status and owner checked by the service. A losing
// receiver never writes history; history/read failures roll back the status too.
export function receiveCreatedOrder(input: ReceiveParcelRecord) {
  return prisma.$transaction(async tx => {
    const changed = await tx.parcelOrder.updateMany({
      where: { id: input.orderId, ownerId: input.ownerId, owner: { role: "SME" }, status: "CREATED" },
      data: { status: "PICKED_UP" },
    });
    if (changed.count !== 1) return null;
    await tx.orderStatusEvent.create({ data: {
      orderId: input.orderId, actorId: input.actorId,
      previousStatus: "CREATED", status: "PICKED_UP", note: input.note,
    } });
    const order = await tx.parcelOrder.findFirst({
      where: { id: input.orderId, ownerId: input.ownerId, owner: { role: "SME" } }, select: orderDetailSelect,
    });
    if (!order) throw new Error("Received parcel could not be read within its transaction.");
    return order;
  });
}
