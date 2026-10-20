import { prisma } from "../../config/prisma";

export function findProfile(id: string) {
  return prisma.profile.findUnique({ where: { id } });
}

export function updateProfile(id: string, data: { fullName?: string | null; phone?: string | null }) {
  return prisma.profile.update({ where: { id }, data });
}
