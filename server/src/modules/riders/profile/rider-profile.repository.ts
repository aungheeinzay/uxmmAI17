import { prisma } from "../../../config/prisma";
import { Prisma } from "../../../generated/prisma/client";
import type { VehicleType } from "../../../generated/prisma/enums";

export const riderProfileInclude = {
  account: { select: { email: true, emailVerifiedAt: true } },
  provider: { select: { id: true, name: true } },
  riderProfile: {
    select: {
      vehicleType: true,
      vehiclePlateNumber: true,
      vehicleModel: true,
      vehicleColor: true,
      completedAt: true,
    },
  },
} as const satisfies Prisma.ProfileInclude;

export type RiderProfileRow = Prisma.ProfileGetPayload<{ include: typeof riderProfileInclude }>;
type Transaction = Prisma.TransactionClient;

export function findRiderProfile(id: string) {
  return prisma.profile.findUnique({ where: { id }, include: riderProfileInclude });
}

export function transaction<T>(work: (tx: Transaction) => Promise<T>) {
  return prisma.$transaction(work);
}

export function findProfile(tx: Transaction, id: string) {
  return tx.profile.findUnique({ where: { id }, include: riderProfileInclude });
}

export function updateIdentity(tx: Transaction, id: string, data: { fullName: string; phone: string }) {
  return tx.profile.update({ where: { id }, data, select: { id: true } });
}

export function saveVehicle(
  tx: Transaction,
  profileId: string,
  data: {
    vehicleType: VehicleType;
    vehiclePlateNumber: string | null;
    vehicleModel: string | null;
    vehicleColor: string | null;
    completedAt: Date | null;
  },
) {
  return tx.riderProfile.upsert({
    where: { profileId },
    create: { profileId, ...data },
    update: data,
    select: { id: true },
  });
}
