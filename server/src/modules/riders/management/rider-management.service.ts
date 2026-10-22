import type { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../../lib/errors/app-error";
import * as repository from "./rider-management.repository";
import type { RiderManagementQuery, RiderDetailQuery } from "./rider-management.validation";
type Actor = { id: string; role: Role };
type Rider = NonNullable<Awaited<ReturnType<typeof repository.findRider>>>;
function pagination(query: RiderDetailQuery, total: number) { return { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) }; }
async function scoped<T>(actor: Actor, work: (tx: repository.Transaction, providerId: string) => Promise<T>) {
  if (actor.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may manage Riders.");
  return repository.transaction(async tx => {
    const operator = await repository.operator(tx, actor.id);
    if (operator?.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may manage Riders.");
    if (!operator.providerId) throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured.");
    return work(tx, operator.providerId);
  });
}
export function workload(pending: number, inProgress: number) {
  return inProgress > 0 ? "DELIVERING" as const : pending > 0 ? "HAS_ASSIGNED_TASKS" as const : "AVAILABLE" as const;
}
function serialize(row: Rider, counts: Awaited<ReturnType<typeof repository.counts>>) {
  const count = (index: number) => counts[index]!.find(group => group.riderId === row.id)?._count._all ?? 0;
  const assignedTaskCount = count(0), inProgressDeliveryCount = count(1);
  return { id: row.id, fullName: row.fullName, phone: row.phone, email: row.account?.email ?? null,
    providerId: row.providerId, provider: row.provider, accountStatus: row.account?.emailVerifiedAt ? "ACTIVATED" : row.account ? "UNVERIFIED" : "NO_ACCOUNT",
    workload: workload(assignedTaskCount, inProgressDeliveryCount), assignedTaskCount, inProgressDeliveryCount,
    activeAssignedTaskCount: assignedTaskCount + inProgressDeliveryCount, completedDeliveryCount: count(2) };
}
export function list(actor: Actor, query: RiderManagementQuery) {
  return scoped(actor, async (tx, providerId) => {
    const { rows, total } = await repository.list(tx, providerId, query);
    const counts = await repository.counts(tx, providerId, rows.map(row => row.id));
    return { riders: rows.map(row => serialize(row, counts)), pagination: pagination(query, total) };
  });
}
export function overview(actor: Actor) { return scoped(actor, (tx, providerId) => repository.overview(tx, providerId)); }
export function invitations(actor: Actor, query: RiderDetailQuery) {
  return scoped(actor, async (tx, providerId) => { const { rows, total } = await repository.invitations(tx, providerId, query); return { invitations: rows, pagination: pagination(query, total) }; });
}
export function detail(actor: Actor, id: string, query: RiderDetailQuery) {
  return scoped(actor, async (tx, providerId) => {
    const row = await repository.findRider(tx, providerId, id);
    if (!row) throw new AppError(404, "RIDER_NOT_FOUND", "Rider not found.");
    const counts = await repository.counts(tx, providerId, [id]);
    const tasks = await repository.assignments(tx, providerId, id, query);
    return { rider: serialize(row, counts), assignments: tasks.rows, pagination: pagination(query, tasks.total) };
  });
}
