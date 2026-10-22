import { z } from "zod";
export const providerNameSchema = z.string().trim().min(1, "Provider name is required.").max(120);
export const cityPriceInputSchema = z.object({
  city: z.string().normalize("NFC").trim().min(1).max(120).regex(/^[\p{L}\p{M} .'-]+$/u, "Enter a city name.").transform(v => v.replace(/\s+/g, " ").toLowerCase()),
  fee: z.string().trim().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Enter a nonnegative fee with at most two decimal places."),
  isActive: z.boolean(),
});
export const cityPriceSchema = z.object({ id: z.string().uuid(), providerId: z.string().uuid(), city: z.string(), fee: z.string(), currency: z.literal("MMK"), isActive: z.boolean(), createdAt: z.string(), updatedAt: z.string() });
export const providerSchema = z.object({ id: z.string().uuid(), name: z.string(), isActive: z.boolean(), cityPrices: z.array(cityPriceSchema), createdAt: z.string(), updatedAt: z.string() });
export const providerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }).strict(),
  z.object({ action: z.literal("create"), name: providerNameSchema }).strict(),
  z.object({ action: z.literal("update"), id: z.string().uuid(), name: providerNameSchema, isActive: z.boolean() }).strict(),
  z.object({ action: z.literal("price"), id: z.string().uuid(), ...cityPriceInputSchema.shape }).strict(),
]);
export type Provider = z.infer<typeof providerSchema>;
export type ProviderAction = z.infer<typeof providerActionSchema>;
