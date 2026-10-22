import type { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../../lib/errors/app-error";
import { isTransactionConflict } from "../../../lib/errors/transaction-conflict";
import { missingFields, normalizeOptional, normalizePlate } from "../profile/rider-profile.service";
import * as repository from "./rider-management.repository";
import type { OperatorRiderUpdateInput, RiderManagementQuery, RiderDetailQuery } from "./rider-management.validation";
type Actor = { id: string; role: Role };
type Rider = NonNullable<Awaited<ReturnType<typeof repository.findRider>>>;
function pagination(query: RiderDetailQuery, total: number) { return { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) }; }
async function scoped<T>(actor: Actor, work: (tx: repository.Transaction, providerId: string) => Promise<T>, mutate = false) {
  if (actor.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may manage Riders.");
  const run = mutate ? repository.mutationTransaction : repository.transaction;
  return run(async tx => {
    const operator = await repository.operator(tx, actor.id);
    if (operator?.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may manage Riders.");
    if (!operator.providerId) throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured.");
    return work(tx, operator.providerId);
  });
}
// Retry only database serialization conflicts. Business errors (404/409) are never retried.
async function mutation<T>(actor: Actor, work: (tx: repository.Transaction, providerId: string) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try { return await scoped(actor, work, true); }
    catch (error) {
      if (!isTransactionConflict(error) || attempt >= 2) throw error;
    }
  }
}
export function workload(pending: number, inProgress: number) {
  return inProgress > 0 ? "DELIVERING" as const : pending > 0 ? "HAS_ASSIGNED_TASKS" as const : "AVAILABLE" as const;
}
function serialize(row: Rider, counts: Awaited<ReturnType<typeof repository.counts>>) {
  const count = (index: number) => counts[index]!.find(group => group.riderId === row.id)?._count._all ?? 0;
  const assignedTaskCount = count(0), inProgressDeliveryCount = count(1);
  const completionSource = {
    role: "RIDER" as const,
    fullName: row.fullName,
    phone: row.phone,
    providerId: row.providerId,
    riderProfile: row.riderProfile,
  };
  const missing = missingFields(completionSource);
  const profileComplete = missing.length === 0;
  return { id: row.id, fullName: row.fullName, phone: row.phone, email: row.account?.email ?? null,
    providerId: row.providerId, provider: row.provider, accountStatus: row.account?.emailVerifiedAt ? "ACTIVATED" : row.account ? "UNVERIFIED" : "NO_ACCOUNT",
    isActive: !row.deactivatedAt, deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
    vehicle: { type: row.riderProfile?.vehicleType ?? null, plateNumber: row.riderProfile?.vehiclePlateNumber ?? null,
      model: row.riderProfile?.vehicleModel ?? null, color: row.riderProfile?.vehicleColor ?? null },
    profileComplete, missingFields: missing, completedAt: profileComplete ? row.riderProfile?.completedAt?.toISOString() ?? null : null,
    workload: workload(assignedTaskCount, inProgressDeliveryCount), assignedTaskCount, inProgressDeliveryCount,
    activeAssignedTaskCount: assignedTaskCount + inProgressDeliveryCount, completedDeliveryCount: count(2) };
}
async function countsFor(tx: repository.Transaction, providerId: string, id: string) {
  return repository.counts(tx, providerId, [id]);
}
async function currentRider(tx: repository.Transaction, providerId: string, id: string) {
  const row = await repository.findRider(tx, providerId, id);
  if (!row) throw new AppError(404, "RIDER_NOT_FOUND", "Rider not found.");
  return row;
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
    const row = await currentRider(tx, providerId, id);
    const counts = await countsFor(tx, providerId, id);
    const tasks = await repository.assignments(tx, providerId, id, query);
    return { rider: serialize(row, counts), assignments: tasks.rows, pagination: pagination(query, tasks.total) };
  });
}
export function update(actor: Actor, id: string, input: OperatorRiderUpdateInput) {
  return mutation(actor, async (tx, providerId) => {
    const current = await currentRider(tx, providerId, id);
    const identity = { fullName: input.fullName.trim(), phone: input.phone.trim() };
    const vehicle = {
      vehicleType: input.vehicleType,
      vehiclePlateNumber: normalizePlate(input.vehiclePlateNumber),
      vehicleModel: normalizeOptional(input.vehicleModel),
      vehicleColor: normalizeOptional(input.vehicleColor),
    };
    const complete = missingFields({
      role: "RIDER",
      fullName: identity.fullName,
      phone: identity.phone,
      providerId: current.providerId,
      riderProfile: { ...vehicle, completedAt: current.riderProfile?.completedAt ?? null },
    }).length === 0;
    // Preserve the first completion timestamp while complete; clear it when required data is removed.
    const completedAt = complete ? current.riderProfile?.completedAt ?? new Date() : null;
    const saved = await repository.updateRider(tx, providerId, id, identity, vehicle, completedAt);
    if (!saved) throw new AppError(404, "RIDER_NOT_FOUND", "Rider not found.");
    return { rider: serialize(saved, await countsFor(tx, providerId, id)) };
  });
}
export function deactivate(actor: Actor, id: string) {
  return mutation(actor, async (tx, providerId) => {
    // Serialize with login/refresh session issuance before reading and revoking sessions.
    await repository.lockRiderAccount(tx, id);
    const rider = await currentRider(tx, providerId, id);
    if (!rider.deactivatedAt) {
      const activeAssignments = await repository.countActiveAssignments(tx, id);
      if (activeAssignments > 0) {
        throw new AppError(409, "RIDER_HAS_ACTIVE_ASSIGNMENTS",
          `This Rider has ${activeAssignments} active assignment${activeAssignments === 1 ? "" : "s"}. Resolve or safely reassign them before deactivating.`);
      }
      const changed = await repository.setDeactivatedAt(tx, providerId, id, new Date());
      if (changed.count !== 1) {
        const latest = await currentRider(tx, providerId, id);
        if (!latest.deactivatedAt) throw new AppError(409, "RIDER_DEACTIVATION_CONFLICT", "The Rider state changed concurrently. Refresh and retry.");
      }
    }
    // Revoke any existing sessions even on an idempotent repeat. The account and history remain.
    await repository.revokeRiderSessions(tx, id);
    const updated = await currentRider(tx, providerId, id);
    return { rider: serialize(updated, await countsFor(tx, providerId, id)) };
  });
}
export function reactivate(actor: Actor, id: string) {
  return mutation(actor, async (tx, providerId) => {
    const rider = await currentRider(tx, providerId, id);
    if (rider.deactivatedAt) {
      const changed = await repository.setDeactivatedAt(tx, providerId, id, null);
      if (changed.count !== 1) {
        const latest = await currentRider(tx, providerId, id);
        if (latest.deactivatedAt) throw new AppError(409, "RIDER_REACTIVATION_CONFLICT", "The Rider state changed concurrently. Refresh and retry.");
      }
    }
    // No assignment is created and no profile completion state is changed here.
    const updated = await currentRider(tx, providerId, id);
    return { rider: serialize(updated, await countsFor(tx, providerId, id)) };
  });
}
