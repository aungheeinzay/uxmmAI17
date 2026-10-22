import type { Role } from "../../generated/prisma/enums";
import { AppError } from "../../lib/errors/app-error";
import { isTransactionConflict } from "../../lib/errors/transaction-conflict";
import * as repository from "./incident.repository";
import type { CreateIncidentInput, IncidentQuery } from "./incident.validation";

type Actor = { id: string; role: Role };
function requireRole(actor: Actor, role: Role) {
  if (actor.role !== role) throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
}
function code(error: unknown) { return typeof error === "object" && error !== null && "code" in error ? error.code : undefined; }
function pagination(query: IncidentQuery, total: number) {
  return { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
}
const duplicate = () => new AppError(409, "INCIDENT_ALREADY_REPORTED", "This parcel already has a report of that type.");
const conflict = () => new AppError(409, "INCIDENT_CONFLICT", "The incident changed before it could be saved. Refresh and try again.");

// Only the assigned Rider may report; the order, Rider and provider all come from
// trusted server data, never from the request body.
export async function createIncident(actor: Actor, input: CreateIncidentInput) {
  requireRole(actor, "RIDER");
  try {
    return await repository.transaction(async tx => {
      const assignment = await repository.findAssignmentForRider(tx, input.assignmentId, actor.id);
      if (!assignment) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found.");
      const rider = await repository.findRiderMembership(tx, actor.id);
      const providerId = assignment.order.deliveryProviderId ?? rider?.providerId;
      if (!providerId) throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your Rider account is not linked to a delivery provider.");
      if (await repository.findExistingIncident(tx, assignment.orderId, input.type)) throw duplicate();
      return repository.insertIncident(tx, {
        orderId: assignment.orderId, riderId: actor.id, assignmentId: assignment.id,
        providerId, type: input.type, reason: input.reason, description: input.description,
      });
    });
  } catch (error) {
    if (String(code(error)) === "P2002") throw duplicate();
    if (String(code(error)) === "P2003" || isTransactionConflict(error)) throw conflict();
    throw error;
  }
}
export async function riderIncidents(actor: Actor, query: IncidentQuery) {
  requireRole(actor, "RIDER");
  const [incidents, total] = await repository.listRiderIncidents(query, actor.id);
  return { incidents, pagination: pagination(query, total) };
}
export async function riderIncident(actor: Actor, id: string) {
  requireRole(actor, "RIDER");
  const incident = await repository.findRiderIncident(id, actor.id);
  if (!incident) throw new AppError(404, "INCIDENT_NOT_FOUND", "Incident not found.");
  return incident;
}
async function providerScope(tx: Parameters<typeof repository.findOperatorMembership>[0], actor: Actor) {
  const member = await repository.findOperatorMembership(tx, actor.id);
  if (member?.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may review incidents.");
  if (!member.providerId) throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured.");
  return member.providerId;
}
export async function operatorIncidents(actor: Actor, query: IncidentQuery) {
  requireRole(actor, "OPERATOR");
  return repository.transaction(async tx => {
    const providerId = await providerScope(tx, actor);
    const [incidents, total] = await repository.listProviderIncidents(tx, query, providerId);
    return { incidents, pagination: pagination(query, total) };
  });
}
export async function operatorIncident(actor: Actor, id: string) {
  requireRole(actor, "OPERATOR");
  return repository.transaction(async tx => {
    const providerId = await providerScope(tx, actor);
    const incident = await repository.findProviderIncident(tx, id, providerId);
    if (!incident) throw new AppError(404, "INCIDENT_NOT_FOUND", "Incident not found.");
    return incident;
  });
}
export async function reviewIncident(actor: Actor, id: string, status: "REVIEWED") {
  requireRole(actor, "OPERATOR");
  return repository.transaction(async tx => {
    const providerId = await providerScope(tx, actor);
    const existing = await repository.findProviderIncident(tx, id, providerId);
    if (!existing) throw new AppError(404, "INCIDENT_NOT_FOUND", "Incident not found.");
    if (existing.status === status) return existing; // Idempotent: reviewing twice is a no-op.
    const updated = await repository.markReviewed(tx, id, providerId, actor.id);
    if (!updated) throw conflict();
    return updated;
  });
}
