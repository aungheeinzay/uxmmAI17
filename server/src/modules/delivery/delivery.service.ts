import * as repository from "./delivery.repository";
import type { DeliveryCityList, DeliveryServiceCatalog } from "./delivery.types";

export const DELIVERY_CURRENCY = "MMK";

export async function listDeliveryServices(city: string): Promise<DeliveryServiceCatalog> {
  const providers = await repository.findServicesForCity(city);
  return {
    city,
    services: providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      city,
      fee: provider.cityPrices[0].fee.toString(),
      currency: DELIVERY_CURRENCY,
    })),
  };
}

export async function listDeliveryCities(): Promise<DeliveryCityList> {
  const rows = await repository.findActiveCities();
  return { cities: rows.map(row => row.city) };
}
