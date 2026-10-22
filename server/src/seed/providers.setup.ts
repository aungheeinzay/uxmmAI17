import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";

export class ProviderSetupError extends Error {}
export function setupTarget(values: NodeJS.ProcessEnv, confirmation: string | undefined, allowRemote: boolean) {
  if (!["development", "test"].includes(values.NODE_ENV ?? "")) throw new ProviderSetupError("Provider setup requires explicit development or test mode.");
  let url: URL;
  try { url = new URL(values.DATABASE_URL ?? ""); } catch { throw new ProviderSetupError("A configured development DATABASE_URL is required."); }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new ProviderSetupError("A PostgreSQL development target is required.");
  const identity = `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  if (confirmation !== identity) throw new ProviderSetupError("Pass --confirm-target with the exact hostname:port/database.");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !allowRemote) {
    throw new ProviderSetupError("Remote development setup requires --allow-remote-development and environment-specific authorization.");
  }
  return { identity };
}

export async function seedProviders(db: Pick<PrismaClient, "deliveryProvider">, names: string[]) {
  const validated = z.array(z.string().trim().min(1).max(120)).min(1).safeParse(names);
  if (!validated.success) throw new ProviderSetupError("Supply at least one valid --name (1–120 characters).");
  const providers = [];
  for (const name of new Set(validated.data)) {
    // An empty update preserves existing activation, prices, ids and order references.
    const row = await db.deliveryProvider.upsert({ where: { name }, create: { name }, update: {}, select: { id: true, name: true } });
    providers.push(row);
  }
  return { providers };
}

export async function assignProvider(db: Pick<PrismaClient, "$transaction">, operatorId: string, providerId: string) {
  return assignMember(db, operatorId, providerId, "OPERATOR");
}
export async function assignRiderProvider(db: Pick<PrismaClient, "$transaction">, riderId: string, providerId: string) {
  const { operatorId, ...result } = await assignMember(db, riderId, providerId, "RIDER");
  return { riderId: operatorId, ...result };
}
async function assignMember(db: Pick<PrismaClient, "$transaction">, operatorId: string, providerId: string, role: "OPERATOR" | "RIDER") {
  if (!z.string().uuid().safeParse(operatorId).success || !z.string().uuid().safeParse(providerId).success) {
    throw new ProviderSetupError("Exact Operator and Provider UUIDs are required.");
  }
  return db.$transaction(async tx => {
    const profile = await tx.profile.findUnique({ where: { id: operatorId }, select: {
      id: true, role: true, providerId: true, account: { select: { emailVerifiedAt: true } },
    } });
    if (profile?.role !== role || !profile.account?.emailVerifiedAt) {
      throw new ProviderSetupError(`An existing verified ${role} account/profile is required.`);
    }
    const provider = await tx.deliveryProvider.findUnique({ where: { id: providerId }, select: { id: true, name: true } });
    if (!provider) throw new ProviderSetupError("The selected Provider does not exist.");
    if (profile.providerId !== null && profile.providerId !== providerId) {
      throw new ProviderSetupError(`${role} already belongs to another Provider; reassignment is refused.`);
    }
    let changed = false;
    if (profile.providerId === null) {
      const result = await tx.profile.updateMany({ where: { id: operatorId, role, providerId: null }, data: { providerId } });
      if (result.count !== 1) throw new ProviderSetupError("Membership changed concurrently. Inspect it before retrying.");
      changed = true;
    }
    return { operatorId, provider, changed };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
