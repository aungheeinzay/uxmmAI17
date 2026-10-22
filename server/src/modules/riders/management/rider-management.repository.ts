import { prisma } from "../../../config/prisma";
import { Prisma } from "../../../generated/prisma/client";
import type { RiderManagementQuery, RiderDetailQuery } from "./rider-management.validation";
export type Transaction = Prisma.TransactionClient;
export const pendingStatuses = ["PICKED_UP"] as const;
export const deliveringStatuses = ["IN_TRANSIT", "OUT_FOR_DELIVERY"] as const;
const activeStatuses = [...pendingStatuses, ...deliveringStatuses];
const person = { id: true, fullName: true, phone: true, providerId: true,
  provider: { select: { id: true, name: true } }, account: { select: { email: true, emailVerifiedAt: true } } } as const;
export function transaction<T>(work: (tx: Transaction) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export function operator(tx: Transaction, id: string) {
  return tx.profile.findUnique({ where: { id }, select: { role: true, providerId: true } });
}
export function riderWhere(providerId: string, query: Partial<RiderManagementQuery> = {}): Prisma.ProfileWhereInput {
  const where: Prisma.ProfileWhereInput = { role: "RIDER", providerId };
  if (query.eligible) where.account = { is: { emailVerifiedAt: { not: null } } };
  if (query.search) where.OR = [
    { fullName: { contains: query.search, mode: "insensitive" } },
    { phone: { contains: query.search, mode: "insensitive" } },
    { account: { is: { email: { contains: query.search, mode: "insensitive" } } } },
  ];
  const tasks = (statuses: readonly ("PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY")[]) => ({ order: { deliveryProviderId: providerId, status: { in: [...statuses] } } });
  if (query.workload === "DELIVERING") where.riderAssignments = { some: tasks(deliveringStatuses) };
  if (query.workload === "AVAILABLE") where.riderAssignments = { none: tasks(activeStatuses) };
  if (query.workload === "HAS_ASSIGNED_TASKS") where.AND = [
    { riderAssignments: { some: tasks(pendingStatuses) } },
    { riderAssignments: { none: tasks(deliveringStatuses) } },
  ];
  return where;
}
export async function list(tx: Transaction, providerId: string, query: RiderManagementQuery) {
  const where = riderWhere(providerId, query);
  const rows = await tx.profile.findMany({ where, select: person, orderBy: [{ fullName: "asc" }, { id: "asc" }],
    skip: (query.page - 1) * query.pageSize, take: query.pageSize });
  const total = await tx.profile.count({ where });
  return { rows, total };
}
export function findRider(tx: Transaction, providerId: string, id: string) {
  return tx.profile.findFirst({ where: { id, role: "RIDER", providerId }, select: person });
}
export async function counts(tx: Transaction, providerId: string, riderIds: string[]) {
  const grouped = (statuses: ("PICKED_UP" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED")[]) => tx.riderAssignment.groupBy({
    by: ["riderId"], where: { riderId: { in: riderIds }, rider: { role: "RIDER", providerId }, order: { deliveryProviderId: providerId, status: { in: statuses } } }, _count: { _all: true },
  });
  if (!riderIds.length) return [[], [], []] as const;
  return Promise.all([grouped(["PICKED_UP"]), grouped(["IN_TRANSIT", "OUT_FOR_DELIVERY"]), grouped(["DELIVERED"])]);
}
export async function overview(tx: Transaction, providerId: string) {
  const count = (workload?: RiderManagementQuery["workload"]) => tx.profile.count({ where: riderWhere(providerId, { workload }) });
  const [totalRiders, available, assigned, delivering] = await Promise.all([count(), count("AVAILABLE"), count("HAS_ASSIGNED_TASKS"), count("DELIVERING")]);
  return { totalRiders, available, assigned, delivering };
}
export async function assignments(tx: Transaction, providerId: string, riderId: string, query: RiderDetailQuery) {
  const where = { riderId, rider: { role: "RIDER" as const, providerId }, order: { deliveryProviderId: providerId } };
  const rows = await tx.riderAssignment.findMany({ where, orderBy: [{ assignedAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    select: { id: true, orderId: true, assignedAt: true, order: { select: { id: true, orderCode: true, recipientName: true, township: true, destinationCity: true, status: true,
      statusEvents: { take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, previousStatus: true, status: true, note: true, createdAt: true } },
    } } } });
  return { rows, total: await tx.riderAssignment.count({ where }) };
}
export async function invitations(tx: Transaction, providerId: string, query: RiderDetailQuery) {
  const where = { providerId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } };
  const rows = await tx.riderInvitation.findMany({ where, select: { id: true, fullName: true, email: true, createdAt: true, expiresAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize });
  return { rows, total: await tx.riderInvitation.count({ where }) };
}
