import { bearerSecurity, errorResponses, ref, response, successSchema } from "../../lib/openapi";

const offeringSchema = {
  type: "object", required: ["id", "name", "city", "fee", "currency"], properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string", example: "Shwe Express" },
    city: { type: "string", example: "yangon" },
    fee: { type: "string", description: "Delivery fee in MMK as a decimal string.", example: "3500" },
    currency: { type: "string", enum: ["MMK"] },
  },
};

export const deliverySchemas = {
  DeliveryServiceOffering: offeringSchema,
  DeliveryServiceOfferings: successSchema({
    type: "object", required: ["city", "services"], properties: {
      city: { type: "string", example: "yangon" },
      services: { type: "array", items: ref("DeliveryServiceOffering") },
    },
  }),
  DeliveryCities: successSchema({
    type: "object", required: ["cities"], properties: {
      cities: { type: "array", items: { type: "string" }, example: ["mandalay", "yangon"] },
    },
  }),
};

const forbidden: Record<number, [string, string]> = {
  403: ["FORBIDDEN", "Only SMEs may read the delivery catalog."],
};

export const deliveryPaths = {
  "/api/delivery/services": { get: {
    operationId: "listDeliveryServices", tags: ["Delivery"], summary: "List delivery providers and fees for a city", security: bearerSecurity,
    description: "Returns active providers that publish an active price for the requested city and have at least one assigned OPERATOR profile, ordered by provider name. The city is trimmed and lowercased before lookup. Fees are decimal strings in MMK. Empty services means no available provider covers the city.",
    parameters: [{
      name: "city", in: "query", required: true, schema: { type: "string", minLength: 1, maxLength: 120 },
      example: "yangon", description: "City name; the catalog stores lowercase names.",
    }],
    responses: {
      200: response("Providers covering the city", ref("DeliveryServiceOfferings"), {
        success: true, data: { city: "yangon", services: [{ id: "ad5baab8-aa17-4d7b-8288-ed7092494d3e", name: "Shwe Express", city: "yangon", fee: "3500", currency: "MMK" }] },
      }),
      ...errorResponses([400, 401, 403, 500], forbidden),
    },
  } },
  "/api/delivery/cities": { get: {
    operationId: "listDeliveryCities", tags: ["Delivery"], summary: "List cities with an active delivery price", security: bearerSecurity,
    description: "Returns the distinct cities that have at least one active price, sorted alphabetically. Used to fill the create-parcel city selector.",
    responses: {
      200: response("Cities with active prices", ref("DeliveryCities"), { success: true, data: { cities: ["mandalay", "yangon"] } }),
      ...errorResponses([401, 403, 500], forbidden),
    },
  } },
};
