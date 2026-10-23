import { prisma } from "../../../config/prisma";

export function findOperatorMembership(id: string) {
  return prisma.profile.findUnique({ where: { id }, select: { role: true, providerId: true } });
}

export function getProviderCohort(providerId: string, start: Date, end: Date) {
  const where = { deliveryProviderId: providerId, createdAt: { gte: start, lt: end } } as const;
  return prisma.$transaction([
    prisma.parcelOrder.count({ where }),
    prisma.parcelOrder.groupBy({ by: ["status"], where, orderBy: { status: "asc" }, _count: { _all: true } }),
    prisma.parcelOrder.findMany({ where, select: { createdAt: true } }),
    prisma.parcelOrder.findMany({
      where: { ...where, status: "DELIVERED" },
      select: { statusEvents: { where: { status: { in: ["PICKED_UP", "DELIVERED"] } }, orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } } },
    }),
  ]);
}
