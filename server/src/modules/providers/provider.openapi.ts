import { bearerSecurity, errorResponses, inputSchema, ref, response, successSchema, requestBody } from "../../lib/openapi";
import { createProviderSchema, updateProviderSchema, priceSchema, citySchema } from "./provider.validation";
export const pricingFields = {
  destinationCity: { type: "string", nullable: true, description: "Canonical lowercase city; null on legacy orders." },
  deliveryProviderId: { type: "string", format: "uuid", nullable: true },
  deliveryProvider: { type: "object", nullable: true, required: ["id", "name"], properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } } },
  deliveryFee: { type: "string", nullable: true, example: "3500.00", description: "Server fee snapshot in MMK; independent of COD and weight. Null means unknown historical fee." },
};
export const pricingRequired = Object.keys(pricingFields);
export const createdPricingFields = {
  destinationCity: { ...pricingFields.destinationCity, nullable: false },
  deliveryProviderId: { ...pricingFields.deliveryProviderId, nullable: false },
  deliveryProvider: { ...pricingFields.deliveryProvider, nullable: false },
  deliveryFee: { ...pricingFields.deliveryFee, nullable: false },
};
const uuid = { type: "string", format: "uuid" };
const fee = { type: "string", pattern: "^[0-9]+\\.[0-9]{2}$", example: "3500.00" };
const timestamps = { createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } };
export const providerSchemas = {
  CreateProviderInput: inputSchema(createProviderSchema),
  UpdateProviderInput: { ...inputSchema(updateProviderSchema), minProperties: 1, description: "Provide name, isActive, or both. Provider names are trimmed, required when supplied, and unique (case-sensitive)." },
  CityPriceInput: { ...inputSchema(priceSchema), description: "fee is required: a nonnegative MMK decimal string (preferred) or JSON number, maximum 9999999999.99, at most two fractional digits. Negative, excess-precision and exponent-form string inputs are rejected. isActive defaults to true on insert and is preserved when omitted on update." },
  DeliveryCityPrice: { type: "object", required: ["id", "providerId", "city", "fee", "currency", "isActive", "createdAt", "updatedAt"], properties: {
    id: uuid, providerId: uuid, city: { type: "string" }, fee, currency: { type: "string", enum: ["MMK"] }, isActive: { type: "boolean" }, ...timestamps,
  } },
  DeliveryProviderAdmin: { type: "object", required: ["id", "name", "isActive", "cityPrices", "createdAt", "updatedAt"], properties: {
    id: uuid, name: { type: "string" }, isActive: { type: "boolean" }, ...timestamps, cityPrices: { type: "array", items: ref("DeliveryCityPrice") },
  } },
  AvailableProviders: { type: "object", required: ["city", "providers"], properties: { city: { type: "string" }, providers: { type: "array", items: {
    type: "object", required: ["id", "name", "deliveryFee", "currency"], properties: { id: uuid, name: { type: "string" }, deliveryFee: fee, currency: { type: "string", enum: ["MMK"] } },
  } } } },
};
const errors = errorResponses([400, 401, 403, 404, 409, 500], { 403: ["FORBIDDEN", "Insufficient permissions."], 404: ["PROVIDER_NOT_FOUND", "Provider not found."], 409: ["PROVIDER_CONFLICT", "Provider name or city price already exists."] });
const common = { tags: ["Delivery Providers"], security: bearerSecurity };
const id = { in: "path", name: "id", required: true, schema: uuid };
export const providerPaths = {
  "/api/delivery-providers": { get: { ...common, operationId: "availableDeliveryProviders", summary: "SME: find active providers for a city",
    description: "SME only. Trims, NFC normalizes, collapses spaces and lowercases city names. Only active providers with active matching city pricing are returned. A valid city without coverage returns providers: []. Operator-configured prices define supported cities. No demo fallback.",
    parameters: [{ in: "query", name: "city", required: true, schema: inputSchema(citySchema) }], responses: { ...errors, 200: response("Eligible providers", successSchema(ref("AvailableProviders"))) },
  } },
  "/api/operator/delivery-providers": {
    get: { ...common, operationId: "listDeliveryProviders", summary: "OPERATOR: list providers and city prices", responses: { ...errors, 200: response("Provider catalog including inactive records", successSchema({ type: "object", required: ["providers"], properties: { providers: { type: "array", items: ref("DeliveryProviderAdmin") } } })) } },
    post: { ...common, operationId: "createDeliveryProvider", summary: "OPERATOR: create a provider", requestBody: requestBody(ref("CreateProviderInput"), { name: "Shwe Express", isActive: true }), responses: { ...errors, 201: response("Created provider", successSchema(ref("DeliveryProviderAdmin"))) } },
  },
  "/api/operator/delivery-providers/{id}": { patch: { ...common, operationId: "updateDeliveryProvider", summary: "OPERATOR: rename or disable provider", parameters: [id], requestBody: requestBody(ref("UpdateProviderInput"), { isActive: false }), responses: { ...errors, 200: response("Updated provider; historical orders retained", successSchema(ref("DeliveryProviderAdmin"))) } } },
  "/api/operator/delivery-providers/{id}/city-prices/{city}": { put: { ...common, operationId: "putDeliveryCityPrice", summary: "OPERATOR: set a fixed city price",
    description: "Atomic upsert on unique(providerId, city). Fee required; isActive optional (preserved on update, true on insert). Existing order snapshots never change. No deletion endpoint.", parameters: [id, { in: "path", name: "city", required: true, schema: inputSchema(citySchema) }], requestBody: requestBody(ref("CityPriceInput"), { fee: "3500.00", isActive: true }), responses: { ...errors, 200: response("Current city price", successSchema(ref("DeliveryCityPrice"))) },
  } },
};
