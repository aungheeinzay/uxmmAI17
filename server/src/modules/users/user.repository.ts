import { prisma } from "../../config/prisma";
const include = { provider: { select: { id: true, name: true, isActive: true } }, account: { select: { email: true } } } as const;

export function findProfile(id: string) {
  return prisma.profile.findUnique({ where: { id }, include });
}

export function updateProfile(id: string, data: { fullName?: string | null; phone?: string | null }) {
  return prisma.profile.update({ where: { id }, data, include });
}
