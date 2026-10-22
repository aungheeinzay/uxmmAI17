import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import type { CreateProviderInput, UpdateProviderInput, PriceInput } from "./provider.validation";
const include = { cityPrices: { orderBy: { city: "asc" as const } } };
export function list() { return prisma.deliveryProvider.findMany({ include, orderBy: { name: "asc" } }); }
export function create(data: CreateProviderInput) { return prisma.deliveryProvider.create({ data, include }); }
export function update(id: string, data: UpdateProviderInput) { return prisma.deliveryProvider.update({ where: { id }, data, include }); }
export function putPrice(providerId: string, city: string, input: PriceInput) {
 const data = { fee: new Prisma.Decimal(input.fee), ...(input.isActive === undefined ? {} : { isActive: input.isActive }) };
 return prisma.deliveryCityPrice.upsert({ where: { providerId_city: { providerId, city } }, create: { providerId, city, ...data }, update: data });
}
export function available(city: string) { return prisma.deliveryProvider.findMany({ where: { isActive: true, cityPrices: { some: { city, isActive: true } } }, select: { id: true, name: true, cityPrices: { where: { city, isActive: true }, select: { fee: true } } }, orderBy: { name: "asc" } }); }
