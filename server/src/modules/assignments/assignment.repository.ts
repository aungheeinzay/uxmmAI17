import { prisma } from "../../config/prisma";
import { pricingSelect } from "../providers/order-pricing";
import { Prisma } from "../../generated/prisma/client";
import type { OrderStatus } from "../../generated/prisma/enums";
import { activeAssignmentStatuses, completedAssignmentStatuses, type AssignmentQuery, type RiderAssignmentQuery } from "./assignment.validation";

type Transaction = Prisma.TransactionClient;
const personSelect = { id: true, fullName: true, phone: true } as const;
const orderSelect = {
  ...pricingSelect,
  id: true, orderCode: true, recipientName: true, phoneNumber: true,
  deliveryAddress: true, township: true, deliveryInstructions: true,
  parcelWeightKg: true, codAmount: true, currency: true, status: true,
  // hasIncident is derived from persisted records, never a mutable flag.
  incidents: { select: { id: true }, take: 1 },
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
export function findOperatorMembership(tx: Transaction, id: string) {
  return tx.profile.findUnique({ where: { id }, select: { role: true, providerId: true } });
}
export function findAssignableOrder(tx: Transaction, id: string, providerId: string) {
  return tx.parcelOrder.findFirst({ where: { id, deliveryProviderId: providerId, owner: { role: "SME" } }, select: { id: true, status: true, assignment: { select: { id: true } } } });
}
export function findEligibleRider(tx: Transaction, id: string, providerId: string) {
  return tx.profile.findFirst({ where: { id, role: "RIDER", providerId, deactivatedAt: null, account: { is: { emailVerifiedAt: { not: null } } } }, select: personSelect });
}
export function insertAssignment(tx: Transaction, input: { orderId: string; riderId: string; assignedById: string }) {
  return tx.riderAssignment.create({ data: input, select: assignmentSelect });
}
export function findRiderAssignment(id: string, riderId: string, tx: Transaction = prisma) {
  return tx.riderAssignment.findFirst({ where: { id, riderId }, select: detailSelect });
}
export function findRiderMembership(id: string) {
  return prisma.profile.findUnique({ where: { id }, select: { role: true, providerId: true, deactivatedAt: true } });
}
export function findRiderAssignmentByParcelReference(riderId: string, providerId: string, reference: { kind: "qr" | "orderCode"; value: string }) {
  const order = reference.kind === "qr" ? { qrIdentifier: reference.value } : { orderCode: reference.value };
  return prisma.riderAssignment.findFirst({
    where: { riderId, rider: { providerId }, order: { ...order, deliveryProviderId: providerId } },
    select: detailSelect,
  });
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
export function listRiderAssignments(query: RiderAssignmentQuery, riderId: string) {
  const statuses: OrderStatus[] | undefined = query.status
    ? [query.status]
    : query.group === "active" ? [...activeAssignmentStatuses]
    : query.group === "completed" ? [...completedAssignmentStatuses]
    : undefined;
  const where: Prisma.RiderAssignmentWhereInput = {
    riderId,
    ...(statuses ? { order: { status: { in: statuses } } } : {}),
  };
  return prisma.$transaction([
    prisma.riderAssignment.findMany({ where, select: assignmentSelect, orderBy: [{ assignedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.riderAssignment.count({ where }),
    // Counts are intentionally scoped to the authenticated Rider's full
    // assignment set, independent of the active tab, filter and page.
    prisma.parcelOrder.groupBy({
      by: ["status"],
      where: { assignment: { is: { riderId } } },
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export function listEligibleRiders(tx: Transaction, query: AssignmentQuery, providerId: string) {
  const where = { role: "RIDER" as const, providerId, deactivatedAt: null, account: { is: { emailVerifiedAt: { not: null } } } };
  return Promise.all([
    tx.profile.findMany({ where, select: personSelect, orderBy: { id: "asc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    tx.profile.count({ where }),
  ]);
}
export function listProviderAssignments(tx: Transaction, query: AssignmentQuery, providerId: string) {
  const where = { rider: { role: "RIDER" as const, providerId }, order: { deliveryProviderId: providerId } };
  return Promise.all([
    tx.riderAssignment.findMany({ where, select: assignmentSelect, orderBy: [{ assignedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    tx.riderAssignment.count({ where }),
  ]);
}
