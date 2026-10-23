import type { Role, OrderStatus } from "../../generated/prisma/enums";
import { AppError } from "../../lib/errors/app-error";
import { serializePricing } from "../providers/order-pricing";
import { isTransactionConflict } from "../../lib/errors/transaction-conflict";
import * as repository from "./assignment.repository";
import { parcelScanSchema, type AssignmentQuery, type CreateAssignmentInput, type DeliveryStatusInput, type RiderAssignmentQuery } from "./assignment.validation";

type Actor = { id: string; role: Role };
function requireRole(actor: Actor, role: Role) {
  if (actor.role !== role) throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
}
const conflict = () => new AppError(409, "ASSIGNMENT_CONFLICT", "Parcel is already assigned or changed concurrently. Refresh before retrying.");
const transitionConflict = () => new AppError(409, "STATUS_TRANSITION_NOT_ALLOWED", "The parcel status changed or this transition is not allowed. Refresh before retrying.");
function code(error: unknown) { return typeof error === "object" && error !== null && "code" in error ? error.code : undefined; }
type AssignmentRow = Awaited<ReturnType<typeof repository.insertAssignment>>;
function serialize<T extends AssignmentRow>(row: T) {
  const { incidents, parcelWeightKg, ...order } = row.order;
  return { ...row, order: { ...order, ...serializePricing(row.order), codAmount: row.order.codAmount.toString(),
    parcelWeight: parcelWeightKg.toString(), parcelWeightUnit: "kg" as const, hasIncident: (incidents?.length ?? 0) > 0 } };
}
function pagination(query: AssignmentQuery, total: number) {
  return { ...query, total, totalPages: Math.ceil(total / query.pageSize) };
}
export type RiderAssignmentCounts = {
  active: { all: number; PICKED_UP: number; IN_TRANSIT: number; OUT_FOR_DELIVERY: number };
  completed: { all: number; DELIVERED: number; FAILED: number; CANCELLED: number };
};
function riderCounts(rows: { status: OrderStatus; _count?: unknown }[]): RiderAssignmentCounts {
  const counts: RiderAssignmentCounts = {
    active: { all: 0, PICKED_UP: 0, IN_TRANSIT: 0, OUT_FOR_DELIVERY: 0 },
    completed: { all: 0, DELIVERED: 0, FAILED: 0, CANCELLED: 0 },
  };
  for (const row of rows) {
    const count = row._count && typeof row._count === "object" && "_all" in row._count && typeof row._count._all === "number" ? row._count._all : 0;
    if (row.status === "PICKED_UP" || row.status === "IN_TRANSIT" || row.status === "OUT_FOR_DELIVERY") {
      counts.active.all += count;
      counts.active[row.status] += count;
    } else if (row.status === "DELIVERED" || row.status === "FAILED" || row.status === "CANCELLED") {
      counts.completed.all += count;
      counts.completed[row.status] += count;
    }
  }
  return counts;
}
async function providerScope(tx: Parameters<typeof repository.findOperatorMembership>[0], actor: Actor) {
  const member = await repository.findOperatorMembership(tx, actor.id);
  if (member?.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may assign Riders.");
  if (!member.providerId) throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured.");
  return member.providerId;
}
export async function eligibleRiders(actor: Actor, query: AssignmentQuery) {
  requireRole(actor, "OPERATOR");
  return repository.transaction(async tx => {
    const providerId = await providerScope(tx, actor);
    const [riders, total] = await repository.listEligibleRiders(tx, query, providerId);
    return { riders, pagination: pagination(query, total) };
  });
}
export async function assignParcel(actor: Actor, input: CreateAssignmentInput) {
  requireRole(actor, "OPERATOR");
  try {
    return await repository.transaction(async tx => {
      const providerId = await providerScope(tx, actor);
      const order = await repository.findAssignableOrder(tx, input.orderId, providerId);
      if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
      if (order.status !== "PICKED_UP") throw new AppError(409, "ORDER_NOT_RECEIVED", "Only PICKED_UP parcels can be assigned.");
      if (order.assignment) throw conflict();
      if (!await repository.findEligibleRider(tx, input.riderId, providerId)) throw new AppError(404, "RIDER_NOT_ELIGIBLE", "An activated Rider in your provider was not found.");
      return serialize(await repository.insertAssignment(tx, { ...input, assignedById: actor.id }));
    });
  } catch (error) {
    if (["P2002", "P2003"].includes(String(code(error))) || isTransactionConflict(error)) throw conflict();
    throw error;
  }
}
export async function operatorAssignments(actor: Actor, query: AssignmentQuery) {
  requireRole(actor, "OPERATOR");
  return repository.transaction(async tx => {
    const providerId = await providerScope(tx, actor);
    const [rows, total] = await repository.listProviderAssignments(tx, query, providerId);
    return { assignments: rows.map(serialize), pagination: pagination(query, total) };
  });
}
export async function riderAssignments(actor: Actor, query: RiderAssignmentQuery) {
  requireRole(actor, "RIDER");
  const [rows, total, counts] = await repository.listRiderAssignments(query, actor.id);
  return { assignments: rows.map(serialize), pagination: pagination(query, total), counts: riderCounts(counts) };
}
export async function riderAssignment(actor: Actor, id: string) {
  requireRole(actor, "RIDER");
  const row = await repository.findRiderAssignment(id, actor.id);
  if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
  return serialize(row);
}
export async function verifyParcelScan(actor: Actor, input: { qrData: string }) {
  requireRole(actor, "RIDER");
  let parsed: { qrData: string };
  try {
    parsed = parcelScanSchema.parse(input);
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Unsupported parcel QR or code.");
  }
  const membership = await repository.findRiderMembership(actor.id);
  if (!membership || membership.role !== "RIDER") throw new AppError(403, "FORBIDDEN", "Only Riders may scan parcels.");
  if (membership.deactivatedAt) throw new AppError(403, "RIDER_DEACTIVATED", "This Rider account is inactive. Contact your Operator.");
  if (!membership.providerId) throw new AppError(403, "RIDER_PROVIDER_MEMBERSHIP_REQUIRED", "Your Rider account is not linked to a delivery provider.");
  const normalized = parsed.qrData.trim();
  const reference = /^[a-f0-9]{64}$/i.test(normalized)
    ? { kind: "qr" as const, value: normalized.toLowerCase() }
    : { kind: "orderCode" as const, value: normalized.toUpperCase() };
  const row = await repository.findRiderAssignmentByParcelReference(actor.id, membership.providerId, reference);
  if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assigned parcel not found.");
  return serialize(row);
}
// Rider-specific subset; SME status workflows are deliberately unchanged.
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  CREATED: [], PICKED_UP: ["IN_TRANSIT"], IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"], DELIVERED: [], FAILED: [], CANCELLED: [],
};
export async function updateDeliveryStatus(actor: Actor, id: string, input: DeliveryStatusInput) {
  requireRole(actor, "RIDER");
  if (input.status === "FAILED" && (input.note?.trim().length ?? 0) < 3) {
    throw new AppError(400, "VALIDATION_ERROR", "A meaningful failure note of at least 3 characters is required.");
  }
  try {
    return await repository.transaction(async tx => {
      const row = await repository.findRiderAssignment(id, actor.id, tx);
      if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
      const previousStatus = row.order.status;
      if (!transitions[previousStatus].includes(input.status)) throw transitionConflict();
      if (!await repository.changeStatus(tx, { id, orderId: row.orderId, riderId: actor.id, previousStatus, status: input.status, note: input.note ?? null })) throw transitionConflict();
      const updated = await repository.findRiderAssignment(id, actor.id, tx);
      if (!updated) throw new Error("Updated assignment unavailable within transaction");
      return { ...serialize(updated), previousStatus };
    });
  } catch (error) {
    if (isTransactionConflict(error)) throw transitionConflict();
    throw error;
  }
}
