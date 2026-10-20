import { prisma } from "../../config/prisma";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
export function findAccount(email: string) {
  return prisma.account.findUnique({ where: { email }, include: { profile: true } });
}
export function createAccount(email: string, passwordHash: string) {
  const id = randomUUID();
  return prisma.account.create({ data: { email, passwordHash, profile: { create: { id, role: "SME" } } }, include: { profile: true } });
}
export function createSession(data: Prisma.AuthSessionUncheckedCreateInput) {
  return prisma.authSession.create({ data });
}
export function findSession(accessHash: string) {
  return prisma.authSession.findUnique({ where: { accessHash }, include: { account: { include: { profile: true } } } });
}
export function rotateSession(refreshHash: string, data: Prisma.AuthSessionUpdateManyMutationInput) {
  return prisma.$transaction(async tx => {
    const current = await tx.authSession.findUnique({ where: { refreshHash }, include: { account: { include: { profile: true } } } });
    if (!current) return null;
    const result = await tx.authSession.updateMany({ where: { id: current.id, refreshHash, refreshExpiresAt: { gt: new Date() } }, data });
    return result.count === 1 ? current.account : null;
  });
}
export function revokeSession(accessHash: string) {
  return prisma.authSession.deleteMany({ where: { accessHash } });
}
