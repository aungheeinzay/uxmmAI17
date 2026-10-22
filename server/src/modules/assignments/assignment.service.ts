import type { Role, OrderStatus } from "../../generated/prisma/enums";
import { AppError } from "../../lib/errors/app-error";
import { serializePricing } from "../providers/order-pricing";
import { isTransactionConflict } from "../../lib/errors/transaction-conflict";
import * as repository from "./assignment.repository";
import type { AssignmentQuery, CreateAssignmentInput, DeliveryStatusInput } from "./assignment.validation";

type Actor = { id: string; role: Role };
function requireRole(actor: Actor, role: Role) {
  if (actor.role !== role) throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
}
const conflict = () => new AppError(409, "ASSIGNMENT_CONFLICT", "Parcel is already assigned or changed concurrently. Refresh before retrying.");
const transitionConflict = () => new AppError(409, "STATUS_TRANSITION_NOT_ALLOWED", "The parcel status changed or this transition is not allowed. Refresh before retrying.");
function code(error: unknown) { return typeof error === "object" && error !== null && "code" in error ? error.code : undefined; }
type AssignmentRow = Awaited<ReturnType<typeof repository.insertAssignment>>;
function serialize<T extends AssignmentRow>(row: T) {
  const { incidents, ...order } = row.order;
  return { ...row, order: { ...order, ...serializePricing(row.order), codAmount: row.order.codAmount.toString(), hasIncident: (incidents?.length ?? 0) > 0 } };
}
function pagination(query: AssignmentQuery, total: number) {
  return { ...query, total, totalPages: Math.ceil(total / query.pageSize) };
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
export async function riderAssignments(actor: Actor, query: AssignmentQuery) {
  requireRole(actor, "RIDER");
  const [rows, total] = await repository.listAssignments(query, actor.id);
  return { assignments: rows.map(serialize), pagination: pagination(query, total) };
}
export async function riderAssignment(actor: Actor, id: string) {
  requireRole(actor, "RIDER");
  const row = await repository.findRiderAssignment(id, actor.id);
  if (!row) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
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
