import { prisma } from "../../config/prisma";

// Active providers that publish an active price for the requested city.
export function findServicesForCity(city: string) {
  return prisma.deliveryProvider.findMany({
    where: { isActive: true, cityPrices: { some: { city, isActive: true } }, operators: { some: { role: "OPERATOR" } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      cityPrices: { where: { city, isActive: true }, select: { fee: true } },
    },
  });
}

export function findActiveCities() {
  return prisma.deliveryCityPrice.groupBy({
    by: ["city"],
    where: { isActive: true },
    orderBy: { city: "asc" },
  });
}
