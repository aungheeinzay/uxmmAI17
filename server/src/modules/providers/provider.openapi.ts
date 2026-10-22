import { bearerSecurity, errorResponses, inputSchema, ref, response, successSchema, requestBody } from "../../lib/openapi";
import { createCityPriceSchema, updateCityPriceSchema, citySchema } from "./provider.validation";
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
  CreateCityPriceInput: { ...inputSchema(createCityPriceSchema), description: "City and fee required. Fee is a nonnegative MMK decimal string (preferred) or JSON number, maximum 9999999999.99, at most two fractional digits. isActive defaults to true. providerId is rejected." },
  UpdateCityPriceInput: { ...inputSchema(updateCityPriceSchema), minProperties: 1, description: "Provide city, fee, isActive, or a combination. Fee maximum 9999999999.99 with at most two fractional digits. providerId is rejected. Updates are scoped to the authenticated Operator's provider." },
  DeliveryCityPrice: { type: "object", required: ["id", "providerId", "city", "fee", "currency", "isActive", "createdAt", "updatedAt"], properties: {
    id: uuid, providerId: uuid, city: { type: "string" }, fee, currency: { type: "string", enum: ["MMK"] }, isActive: { type: "boolean" }, ...timestamps,
  } },
  MyDeliveryProvider: { type: "object", required: ["provider"], properties: { provider: { type: "object", nullable: true, required: ["id", "name", "isActive", "cityPrices"], properties: {
    id: uuid, name: { type: "string" }, isActive: { type: "boolean", description: "Read-only provider state; Operators cannot change it." }, cityPrices: { type: "array", items: ref("DeliveryCityPrice") },
  } } }, description: "provider is null when membership is not configured. Show: Your delivery provider has not been configured. No automatic assignment or provider creation." },
  AvailableProviders: { type: "object", required: ["city", "providers"], properties: { city: { type: "string" }, providers: { type: "array", items: {
    type: "object", required: ["id", "name", "deliveryFee", "currency"], properties: { id: uuid, name: { type: "string" }, deliveryFee: fee, currency: { type: "string", enum: ["MMK"] } },
  } } } },
};
const readErrors = errorResponses([400, 401, 403, 500], { 403: ["FORBIDDEN", "Insufficient permissions."] });
const membershipErrors = { ...readErrors, ...errorResponses([409], {
  409: ["PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured. PRICING_CONFLICT indicates a concurrent membership/pricing change; refresh and retry."],
}) };
const mutationErrors = { ...membershipErrors, 409: response("PROVIDER_MEMBERSHIP_REQUIRED: membership is missing. CITY_PRICE_CONFLICT: pricing already exists for the normalized city. PRICING_CONFLICT: concurrent membership/pricing change; refresh before retrying.", ref("Error")) };
const common = { tags: ["Delivery Providers"], security: bearerSecurity };
export const providerPaths = {
  "/api/delivery-providers": { get: { ...common, operationId: "availableDeliveryProviders", summary: "SME: find active providers for a city",
    description: "SME only. Trims, NFC normalizes, collapses spaces and lowercases city names. Only active providers with active matching city pricing are returned. A valid city without coverage returns providers: []. Operator-configured prices define supported cities. No demo fallback.",
    parameters: [{ in: "query", name: "city", required: true, schema: inputSchema(citySchema) }], responses: { ...readErrors, 200: response("Eligible providers (empty array when no coverage)", successSchema(ref("AvailableProviders")), { success: true, data: { city: "yangon", providers: [] } }) },
  } },
  "/api/operator/my-provider": { get: { ...common, operationId: "myDeliveryProvider", summary: "OPERATOR: read my provider and city prices",
    description: "Resolves membership from the authenticated Operator's persisted Profile.providerId. Returns provider:null when unconfigured. Membership is provisioned through the controlled development CLI operator:assign-provider with explicit Operator and Provider IDs; there is no public membership-assignment endpoint. Ordinary profile PATCH cannot change membership. Provider name/state are read-only. Provider seeding is a separate development CLI (seed:providers), not an Operator API.",
    responses: { ...readErrors, ...errorResponses([409], { 409: ["PRICING_CONFLICT", "Membership changed concurrently. Refresh and retry."] }), 200: response("Own provider or null when membership has not been configured", successSchema(ref("MyDeliveryProvider")), { success: true, data: { provider: { id: "770e8400-e29b-41d4-a716-446655440000", name: "Flash Deliver", isActive: true, cityPrices: [] } } }) },
  } },
  "/api/operator/my-provider/city-prices": {
    get: { ...common, operationId: "myProviderCityPrices", summary: "OPERATOR: list own provider's city prices", responses: { ...membershipErrors, 200: response("Own city prices", successSchema({ type: "object", required: ["cityPrices"], properties: { cityPrices: { type: "array", items: ref("DeliveryCityPrice") } } })) } },
    post: { ...common, operationId: "createMyProviderCityPrice", summary: "OPERATOR: add a city to my provider", requestBody: requestBody(ref("CreateCityPriceInput"), { city: "Yangon", fee: "3500.00", isActive: true }), responses: { ...mutationErrors, 201: response("City price created", successSchema(ref("DeliveryCityPrice"))) } },
  },
  "/api/operator/my-provider/city-prices/{priceId}": { patch: { ...common, operationId: "updateMyProviderCityPrice", summary: "OPERATOR: edit or toggle own city pricing",
    description: "Both priceId and persisted membership providerId filter the update in a Serializable transaction. Another provider's price returns 404. No providerId input is accepted. Historical order snapshots never change.", parameters: [{ in: "path", name: "priceId", required: true, schema: uuid }], requestBody: requestBody(ref("UpdateCityPriceInput"), { isActive: false }), responses: { ...mutationErrors, ...errorResponses([404], { 404: ["CITY_PRICE_NOT_FOUND", "City pricing not found or belongs to another provider."] }), 200: response("City price updated", successSchema(ref("DeliveryCityPrice"))) },
  } },
};
