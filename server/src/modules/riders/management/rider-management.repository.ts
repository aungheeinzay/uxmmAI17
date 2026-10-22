import { prisma } from "../../../config/prisma";
import { Prisma } from "../../../generated/prisma/client";
import type { VehicleType } from "../../../generated/prisma/enums";
import type { RiderManagementQuery, RiderDetailQuery } from "./rider-management.validation";
export type Transaction = Prisma.TransactionClient;
export const pendingStatuses = ["PICKED_UP"] as const;
export const deliveringStatuses = ["IN_TRANSIT", "OUT_FOR_DELIVERY"] as const;
export const activeStatuses = [...pendingStatuses, ...deliveringStatuses];
const person = { id: true, fullName: true, phone: true, providerId: true, deactivatedAt: true,
  provider: { select: { id: true, name: true } }, account: { select: { email: true, emailVerifiedAt: true } },
  riderProfile: { select: { vehicleType: true, vehiclePlateNumber: true, vehicleModel: true, vehicleColor: true, completedAt: true } } } as const;
export function transaction<T>(work: (tx: Transaction) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
// Writes that change eligibility use Serializable so an assignment cannot be created
// from a stale eligibility read while deactivation is in progress.
export function mutationTransaction<T>(work: (tx: Transaction) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export function operator(tx: Transaction, id: string) {
  return tx.profile.findUnique({ where: { id }, select: { role: true, providerId: true } });
}
export function riderWhere(providerId: string, query: Partial<RiderManagementQuery> = {}): Prisma.ProfileWhereInput {
  const where: Prisma.ProfileWhereInput = { role: "RIDER", providerId };
  if (query.eligible) {
    where.account = { is: { emailVerifiedAt: { not: null } } };
    // Assignment selection only ever considers operationally active Riders.
    where.deactivatedAt = null;
  } else if (query.status === "ACTIVE") {
    where.deactivatedAt = null;
  } else if (query.status === "INACTIVE") {
    where.deactivatedAt = { not: null };
  }
  // Workload describes active operations, so workload filters never include
  // deactivated Riders unless the caller explicitly asks for inactive Riders.
  if (query.workload && query.status !== "INACTIVE") where.deactivatedAt = null;
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
  const count = (workload?: RiderManagementQuery["workload"], status?: RiderManagementQuery["status"]) =>
    tx.profile.count({ where: riderWhere(providerId, { workload, status }) });
  const [totalRiders, available, assigned, delivering, inactive] = await Promise.all([
    count(), count("AVAILABLE", "ACTIVE"), count("HAS_ASSIGNED_TASKS", "ACTIVE"), count("DELIVERING", "ACTIVE"), count(undefined, "INACTIVE"),
  ]);
  return { totalRiders, available, assigned, delivering, inactive };
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
export async function updateRider(
  tx: Transaction,
  providerId: string,
  id: string,
  identity: { fullName: string; phone: string },
  vehicle: { vehicleType: VehicleType; vehiclePlateNumber: string | null; vehicleModel: string | null; vehicleColor: string | null },
  completedAt: Date | null,
) {
  const changed = await tx.profile.updateMany({ where: { id, role: "RIDER", providerId }, data: identity });
  if (changed.count !== 1) return null;
  await tx.riderProfile.upsert({
    where: { profileId: id },
    create: { profileId: id, ...vehicle, completedAt },
    update: { ...vehicle, completedAt },
  });
  return tx.profile.findFirst({ where: { id, role: "RIDER", providerId }, select: person });
}
export function countActiveAssignments(tx: Transaction, riderId: string) {
  return tx.riderAssignment.count({ where: { riderId, order: { status: { in: [...activeStatuses] } } } });
}
export function setDeactivatedAt(tx: Transaction, providerId: string, id: string, deactivatedAt: Date | null) {
  return tx.profile.updateMany({
    where: { id, role: "RIDER", providerId, deactivatedAt: deactivatedAt ? null : { not: null } },
    data: { deactivatedAt },
  });
}
export function lockRiderAccount(tx: Transaction, profileId: string) {
  // Session issuance and rotation already lock this account row. Taking the same
  // lock serializes deactivation with those writers; authentication also re-checks
  // the deactivated flag on every request as defense in depth.
  return tx.$queryRaw`SELECT "id" FROM "public"."accounts" WHERE "id" = ${profileId}::uuid FOR UPDATE`;
}
export function revokeRiderSessions(tx: Transaction, profileId: string) {
  // Profile and Account share the same id in this schema. Removing sessions makes
  // an already-authenticated Rider fail immediately while retaining the account.
  return tx.authSession.deleteMany({ where: { accountId: profileId } });
}
