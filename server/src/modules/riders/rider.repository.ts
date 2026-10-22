import { randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";

type InvitationInput = {
  email: string; fullName?: string; tokenHash: string; invitedById: string; expiresAt: Date;
};

export function reserveInvitation(input: InvitationInput) {
  return prisma.$transaction(async tx => {
    const operator = await tx.account.findUnique({ where: { id: input.invitedById }, include: { profile: true } });
    if (operator?.profile.role !== "OPERATOR" || !operator.emailVerifiedAt) return { status: "forbidden" } as const;
    if (!operator.profile.providerId) return { status: "membership_required" } as const;
    if (await tx.account.findUnique({ where: { email: input.email } })) return { status: "conflict" } as const;
    const previous = await tx.riderInvitation.findUnique({ where: { email: input.email } });
    const providerId = operator.profile.providerId;
    if (previous && (previous.providerId ? previous.providerId !== providerId : previous.invitedById !== input.invitedById)) return { status: "conflict" } as const;
    const data = { ...input, providerId, fullName: input.fullName ?? null, createdAt: new Date(), acceptedAt: null, revokedAt: null };
    if (previous) {
      // Conditional update locks the row and rechecks eligibility after concurrent writes.
      const updated = await tx.riderInvitation.updateMany({
        where: { id: previous.id, tokenHash: previous.tokenHash, acceptedAt: null,
          OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] }, data,
      });
      if (updated.count !== 1) return { status: "conflict" } as const;
      return { status: "created", id: previous.id } as const;
    }
    const invitation = await tx.riderInvitation.create({ data });
    return { status: "created", id: invitation.id } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function invalidateInvitation(tokenHash: string) {
  // A failed old send must not revoke a newer replacement or accepted invitation.
  return prisma.riderInvitation.updateMany({ where: { tokenHash, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
}

export function activateInvitation(tokenHash: string, passwordHash: string) {
  return prisma.$transaction(async tx => {
    const invitation = await tx.riderInvitation.findUnique({ where: { tokenHash } });
    if (!invitation) return "invalid" as const;
    // Legacy pending invitations use the trusted inviter's membership at activation.
    // New invitations retain their captured provider even if the inviter later moves.
    let providerId = invitation.providerId;
    if (!providerId) {
      const inviter = await tx.account.findUnique({ where: { id: invitation.invitedById }, include: { profile: true } });
      if (inviter?.profile.role !== "OPERATOR" || !inviter.emailVerifiedAt || !inviter.profile.providerId) return "invalid" as const;
      providerId = inviter.profile.providerId;
    }
    const now = new Date();
    const consumed = await tx.riderInvitation.updateMany({
      where: { id: invitation.id, tokenHash, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, providerId },
    });
    if (consumed.count !== 1) return "invalid" as const;
    // A unique account email also protects the race with ordinary SME registration.
    const id = randomUUID();
    await tx.account.create({ data: {
      email: invitation.email, passwordHash, emailVerifiedAt: now,
      profile: { create: { id, role: "RIDER" as const, fullName: invitation.fullName, providerId } },
    } });
    return "activated" as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
