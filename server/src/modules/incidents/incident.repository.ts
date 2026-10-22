import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import type { IncidentType } from "../../generated/prisma/enums";
import type { IncidentQuery } from "./incident.validation";

type Transaction = Prisma.TransactionClient;
const personSelect = { id: true, fullName: true, phone: true } as const;
const orderSelect = {
  id: true, orderCode: true, recipientName: true, township: true,
  deliveryAddress: true, status: true, deliveryProviderId: true,
} as const;

// Shared projection so Rider and Operator reads serialize identically.
export const incidentSelect = {
  id: true, orderId: true, riderId: true, assignmentId: true, providerId: true,
  type: true, reason: true, description: true, status: true,
  reviewedAt: true, reviewedById: true, createdAt: true, updatedAt: true,
  rider: { select: personSelect },
  reviewedBy: { select: personSelect },
  order: { select: orderSelect },
} as const satisfies Prisma.RiderIncidentSelect;

export function transaction<T>(work: (tx: Transaction) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export function findOperatorMembership(tx: Transaction, id: string) {
  return tx.profile.findUnique({ where: { id }, select: { role: true, providerId: true } });
}
export function findRiderMembership(tx: Transaction, id: string) {
  return tx.profile.findUnique({ where: { id }, select: { role: true, providerId: true } });
}
export function findAssignmentForRider(tx: Transaction, id: string, riderId: string) {
  return tx.riderAssignment.findFirst({
    where: { id, riderId },
    select: { id: true, orderId: true, order: { select: { id: true, deliveryProviderId: true } } },
  });
}
export function findExistingIncident(tx: Transaction, orderId: string, type: IncidentType) {
  return tx.riderIncident.findUnique({ where: { orderId_type: { orderId, type } }, select: { id: true } });
}
export function insertIncident(tx: Transaction, data: { orderId: string; riderId: string; assignmentId: string; providerId: string; type: IncidentType; reason: string; description: string }) {
  return tx.riderIncident.create({ data, select: incidentSelect });
}
export function listRiderIncidents(query: IncidentQuery, riderId: string) {
  const where = { riderId, ...(query.status ? { status: query.status } : {}) };
  return prisma.$transaction([
    prisma.riderIncident.findMany({ where, select: incidentSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.riderIncident.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export function findRiderIncident(id: string, riderId: string) {
  return prisma.riderIncident.findFirst({ where: { id, riderId }, select: incidentSelect });
}
export function listProviderIncidents(tx: Transaction, query: IncidentQuery, providerId: string) {
  const where = { providerId, ...(query.status ? { status: query.status } : {}) };
  return Promise.all([
    tx.riderIncident.findMany({ where, select: incidentSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    tx.riderIncident.count({ where }),
  ]);
}
export function findProviderIncident(tx: Transaction, id: string, providerId: string) {
  return tx.riderIncident.findFirst({ where: { id, providerId }, select: incidentSelect });
}
// Compare-and-swap so two Operators cannot both "review" the same open incident.
export async function markReviewed(tx: Transaction, id: string, providerId: string, reviewerId: string) {
  const changed = await tx.riderIncident.updateMany({
    where: { id, providerId, status: "OPEN" },
    data: { status: "REVIEWED", reviewedAt: new Date(), reviewedById: reviewerId },
  });
  if (changed.count !== 1) return null;
  return tx.riderIncident.findFirst({ where: { id, providerId }, select: incidentSelect });
}
