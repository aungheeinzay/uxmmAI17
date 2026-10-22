import { getSessionJson } from "@/lib/api-client";
import { deliveryCitiesResponseSchema, deliveryServicesResponseSchema } from "../schemas/delivery.schema";

export async function fetchDeliveryServices(city: string) {
  const payload = await getSessionJson("delivery/services", { city });
  const result = deliveryServicesResponseSchema.safeParse(payload);
  if (!result.success) throw new Error("INVALID_DELIVERY_SERVICES_RESPONSE");
  return result.data.data;
}

export async function fetchDeliveryCities() {
  const payload = await getSessionJson("delivery/cities");
  const result = deliveryCitiesResponseSchema.safeParse(payload);
  if (!result.success) throw new Error("INVALID_DELIVERY_CITIES_RESPONSE");
  return result.data.data;
}
