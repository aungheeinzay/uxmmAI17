import { prisma } from "../../config/prisma";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
export function findAccount(email: string) {
  return prisma.account.findUnique({
    where: { email },
    include: { profile: true },
  });
}
export function createAccount(email: string, passwordHash: string) {
  const id = randomUUID();
  return prisma.account.create({
    data: { email, passwordHash, profile: { create: { id, role: "SME" } } },
    include: { profile: true },
  });
}
export function createSession(
  data: Prisma.AuthSessionUncheckedCreateInput,
  passwordHash: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, data.accountId);
    const account = await tx.account.findUnique({
      where: { id: data.accountId },
      include: { profile: true },
    });
    // Prevent a login checked before a concurrent password reset or deactivation
    // from creating a stale session.
    if (!account?.emailVerifiedAt || account.passwordHash !== passwordHash
      || (account.profile.role === "RIDER" && account.profile.deactivatedAt))
      return null;
    return tx.authSession.create({ data });
  });
}
export function findSession(accessHash: string) {
  return prisma.authSession.findUnique({
    where: { accessHash },
    include: { account: { include: { profile: true } } },
  });
}
export function rotateSession(
  refreshHash: string,
  data: Prisma.AuthSessionUpdateManyMutationInput,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.authSession.findUnique({
      where: { refreshHash },
      include: { account: { include: { profile: true } } },
    });
    if (!current) return null;
    await lockAccount(tx, current.accountId);
    const account = await tx.account.findUnique({
      where: { id: current.accountId },
      include: { profile: true },
    });
    if (!account?.emailVerifiedAt || (account.profile.role === "RIDER" && account.profile.deactivatedAt)) return null;
    const result = await tx.authSession.updateMany({
      where: {
        id: current.id,
        refreshHash,
        refreshExpiresAt: { gt: new Date() },
      },
      data,
    });
    return result.count === 1 ? account : null;
  });
}

export type TokenPurpose = "verification" | "password-reset";

async function lockAccount(tx: Prisma.TransactionClient, id: string) {
  // Serialize issuance, consumption, reset and session creation for the same account.
  await tx.$queryRaw`SELECT "id" FROM "public"."accounts" WHERE "id" = ${id}::uuid FOR UPDATE`;
}

export function reserveEmailToken(
  accountId: string,
  purpose: TokenPurpose,
  tokenHash: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, accountId);
    const account = await tx.account.findUnique({ where: { id: accountId } });
    if (!account || (purpose === "verification" && account.emailVerifiedAt))
      return false;
    const previous =
      purpose === "verification"
        ? await tx.emailVerificationToken.findUnique({ where: { accountId } })
        : await tx.passwordResetToken.findUnique({ where: { accountId } });
    const now = new Date();
    if (previous && now.getTime() - previous.createdAt.getTime() < 60000)
      return false;
    const data = {
      accountId,
      tokenHash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60000),
    };
    if (purpose === "verification") {
      await tx.emailVerificationToken.upsert({
        where: { accountId },
        create: data,
        update: data,
      });
    } else {
      await tx.passwordResetToken.upsert({
        where: { accountId },
        create: data,
        update: data,
      });
    }
    return true;
  });
}

export async function invalidateFailedEmailToken(
  purpose: TokenPurpose,
  tokenHash: string,
) {
  // Match only this failed delivery; a later resend must remain valid. Keep cooldown metadata.
  if (purpose === "verification") {
    await prisma.emailVerificationToken.updateMany({
      where: { tokenHash },
      data: { expiresAt: new Date(0) },
    });
  } else {
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash },
      data: { expiresAt: new Date(0) },
    });
  }
}

export function consumeVerificationToken(tokenHash: string) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.emailVerificationToken.findUnique({
      where: { tokenHash },
    });
    if (!candidate) return false;
    await lockAccount(tx, candidate.accountId);
    const consumed = await tx.emailVerificationToken.deleteMany({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return false;
    await tx.account.update({
      where: { id: candidate.accountId },
      data: { emailVerifiedAt: new Date() },
    });
    return true;
  });
}

export function resetAccountPassword(tokenHash: string, passwordHash: string) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!candidate) return false;
    await lockAccount(tx, candidate.accountId);
    const consumed = await tx.passwordResetToken.deleteMany({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) return false;
    await tx.account.update({
      where: { id: candidate.accountId },
      data: { passwordHash },
    });
    await tx.passwordResetToken.deleteMany({
      where: { accountId: candidate.accountId },
    });
    await tx.authSession.deleteMany({
      where: { accountId: candidate.accountId },
    });
    // Resetting a password is not a substitute for the separate verification step.
    return true;
  });
}
export function revokeSession(accessHash: string) {
  return prisma.authSession.deleteMany({ where: { accessHash } });
}
