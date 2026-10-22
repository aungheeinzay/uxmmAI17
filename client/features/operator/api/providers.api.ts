import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { myProviderSchema, providerActionSchema, type ProviderAction } from "../types/provider.types";
export async function providerAction(input: ProviderAction) { return postSessionJson("operator/delivery-providers", providerActionSchema.parse(input)); }
export async function getProviders() {
  const result = z.object({ success: z.literal(true), data: myProviderSchema }).safeParse(await providerAction({ action: "list" }));
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
export function providerError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "PROVIDER_MEMBERSHIP_REQUIRED") return "Your delivery provider has not been configured.";
    if (error.code === "CITY_PRICE_CONFLICT") return "Pricing already exists for this city. Edit the existing city price.";
    if (error.status === 409) return "Membership or pricing changed. Refresh and try again.";
    if (error.status === 400) return "Check the provider name, city and fee.";
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "Only Operators can manage providers.";
    if (error.status === 404) return "City pricing was not found. Refresh the list.";
  }
  return "Unable to save provider pricing. Check your connection and retry.";
}
