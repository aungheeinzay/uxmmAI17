import { AppError } from "../../lib/errors/app-error";
import type { Role } from "../../generated/prisma/enums";
import * as repository from "./provider.repository";
import type { CreateCityPriceInput, UpdateCityPriceInput } from "./provider.validation";
import { isTransactionConflict } from "../../lib/errors/transaction-conflict";
type Actor = { id: string; role: Role };
function authorize(actor: Actor, role: Role) { if (actor.role !== role) throw new AppError(403, "FORBIDDEN", "Insufficient permissions."); }
type Provider = NonNullable<NonNullable<Awaited<ReturnType<typeof repository.membership>>>["provider"]>;
async function scoped<T>(actor: Actor, required: boolean, work: (tx: repository.Transaction, provider: Provider | null) => Promise<T>) {
  authorize(actor, "OPERATOR");
  try {
    return await repository.transaction(async tx => {
      const profile = await repository.membership(tx, actor.id);
      if (!profile || profile.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Insufficient permissions.");
      if (required && !profile.provider) throw new AppError(409, "PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured.");
      return work(tx, profile.provider);
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") throw new AppError(409, "CITY_PRICE_CONFLICT", "Pricing already exists for this city.");
    if (isTransactionConflict(error)) throw new AppError(409, "PRICING_CONFLICT", "Membership or pricing changed concurrently. Refresh and retry.");
    throw error;
  }
}
function price<T extends { fee: { toFixed: (places: number) => string } }>(row: T) { return { ...row, fee: row.fee.toFixed(2), currency: "MMK" as const }; }
export function myProvider(actor: Actor) {
  return scoped(actor, false, async (_tx, provider) => ({ provider: provider ? { ...provider, cityPrices: provider.cityPrices.map(price) } : null }));
}
export function cityPrices(actor: Actor) {
  return scoped(actor, true, async (_tx, provider) => ({ cityPrices: provider!.cityPrices.map(price) }));
}
export function createPrice(actor: Actor, input: CreateCityPriceInput) {
  return scoped(actor, true, async (tx, provider) => price(await repository.createPrice(tx, provider!.id, input)));
}
export function updatePrice(actor: Actor, id: string, input: UpdateCityPriceInput) {
  return scoped(actor, true, async (tx, provider) => {
    const updated = await repository.updatePrice(tx, provider!.id, id, input);
    if (!updated) throw new AppError(404, "CITY_PRICE_NOT_FOUND", "City pricing not found.");
    return price(updated);
  });
}
export async function available(actor: Actor, city: string) { authorize(actor, "SME"); return { city, providers: (await repository.available(city)).map(row => ({ id: row.id, name: row.name, deliveryFee: row.cityPrices[0]!.fee.toFixed(2), currency: "MMK" as const })) }; }
