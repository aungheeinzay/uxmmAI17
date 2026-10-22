import { prisma } from "../../config/prisma";
import { pricingSelect } from "../providers/order-pricing";
import { Prisma } from "../../generated/prisma/client";
import type { OrderStatus } from "../../generated/prisma/enums";
import type { AssignmentQuery } from "./assignment.validation";

type Transaction = Prisma.TransactionClient;
const personSelect = { id: true, fullName: true, phone: true } as const;
const orderSelect = {
  ...pricingSelect,
  id: true, orderCode: true, recipientName: true, phoneNumber: true,
  deliveryAddress: true, township: true, deliveryInstructions: true,
  codAmount: true, currency: true, status: true,
} as const;
export const assignmentSelect = {
  id: true, orderId: true, riderId: true, assignedById: true, assignedAt: true,
  rider: { select: personSelect }, assignedBy: { select: personSelect }, order: { select: orderSelect },
} as const satisfies Prisma.RiderAssignmentSelect;
const detailSelect = { ...assignmentSelect, order: { select: { ...orderSelect, statusEvents: {
  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  select: { id: true, previousStatus: true, status: true, note: true, createdAt: true,
    actor: { select: { id: true, fullName: true } } },
} } } } as const satisfies Prisma.RiderAssignmentSelect;

export function transaction<T>(work: (tx: Transaction) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export function findAssignableOrder(tx: Transaction, id: string) {
  return tx.parcelOrder.findFirst({ where: { id, owner: { role: "SME" } }, select: { id: true, status: true, assignment: { select: { id: true } } } });
}
export function findEligibleRider(tx: Transaction, id: string) {
  return tx.profile.findFirst({ where: { id, role: "RIDER", account: { is: { emailVerifiedAt: { not: null } } } }, select: personSelect });
}
export function insertAssignment(tx: Transaction, input: { orderId: string; riderId: string; assignedById: string }) {
  return tx.riderAssignment.create({ data: input, select: assignmentSelect });
}
export function findRiderAssignment(id: string, riderId: string, tx: Transaction = prisma) {
  return tx.riderAssignment.findFirst({ where: { id, riderId }, select: detailSelect });
}
export async function changeStatus(tx: Transaction, input: { id: string; orderId: string; riderId: string; previousStatus: OrderStatus; status: OrderStatus; note: string | null }) {
  const changed = await tx.parcelOrder.updateMany({ where: {
    id: input.orderId, status: input.previousStatus,
    assignment: { is: { id: input.id, riderId: input.riderId } },
  }, data: { status: input.status } });
  if (changed.count !== 1) return false;
  await tx.orderStatusEvent.create({ data: {
    orderId: input.orderId, actorId: input.riderId, previousStatus: input.previousStatus,
    status: input.status, note: input.note,
  } });
  return true;
}
export function listAssignments(query: AssignmentQuery, riderId?: string) {
  const where = riderId ? { riderId } : {};
  return prisma.$transaction([
    prisma.riderAssignment.findMany({ where, select: assignmentSelect, orderBy: [{ assignedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.riderAssignment.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export function listEligibleRiders(query: AssignmentQuery) {
  const where = { role: "RIDER" as const, account: { is: { emailVerifiedAt: { not: null } } } };
  return prisma.$transaction([
    prisma.profile.findMany({ where, select: personSelect, orderBy: { id: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.profile.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
