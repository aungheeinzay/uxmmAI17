import type { Prisma } from "../../generated/prisma/client";
export type OrderPricing = {
  destinationCity: string | null;
  deliveryProviderId: string | null;
  deliveryProvider: { id: string; name: string } | null;
  deliveryFee: string | null;
};
export const pricingSelect = {
  destinationCity: true, deliveryProviderId: true, deliveryFee: true,
  deliveryProvider: { select: { id: true, name: true } },
} as const;
export function serializePricing(row: { destinationCity?: string | null; deliveryProviderId?: string | null; deliveryProvider?: { id: string; name: string } | null; deliveryFee?: Prisma.Decimal | null }): OrderPricing {
  return { destinationCity: row.destinationCity ?? null, deliveryProviderId: row.deliveryProviderId ?? null,
    deliveryProvider: row.deliveryProvider ?? null, deliveryFee: row.deliveryFee?.toFixed(2) ?? null };
}
