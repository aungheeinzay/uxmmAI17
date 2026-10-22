import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import type { CreateCityPriceInput, UpdateCityPriceInput } from "./provider.validation";
export type Transaction = Prisma.TransactionClient;
export function transaction<T>(work: (tx: Transaction) => Promise<T>) {
  return prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
export function membership(tx: Transaction, id: string) {
  return tx.profile.findUnique({ where: { id }, select: { role: true, providerId: true, provider: {
    select: { id: true, name: true, isActive: true, cityPrices: { orderBy: { city: "asc" } } },
  } } });
}
export function createPrice(tx: Transaction, providerId: string, input: CreateCityPriceInput) {
  return tx.deliveryCityPrice.create({ data: { providerId, city: input.city, fee: new Prisma.Decimal(input.fee), isActive: input.isActive ?? true } });
}
export async function updatePrice(tx: Transaction, providerId: string, id: string, input: UpdateCityPriceInput) {
  const data = { ...(input.city === undefined ? {} : { city: input.city }),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    ...(input.fee === undefined ? {} : { fee: new Prisma.Decimal(input.fee) }) };
  const changed = await tx.deliveryCityPrice.updateMany({ where: { id, providerId }, data });
  if (changed.count !== 1) return null;
  return tx.deliveryCityPrice.findFirst({ where: { id, providerId } });
}
export function available(city: string) { return prisma.deliveryProvider.findMany({ where: { isActive: true, cityPrices: { some: { city, isActive: true } } }, select: { id: true, name: true, cityPrices: { where: { city, isActive: true }, select: { fee: true } } }, orderBy: { name: "asc" } }); }
