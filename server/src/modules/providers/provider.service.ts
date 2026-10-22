import { AppError } from "../../lib/errors/app-error";
import type { Role } from "../../generated/prisma/enums";
import * as repository from "./provider.repository";
import type { CreateProviderInput, UpdateProviderInput, PriceInput } from "./provider.validation";
type Actor = { id: string; role: Role };
function authorize(actor: Actor, role: Role) { if (actor.role !== role) throw new AppError(403, "FORBIDDEN", "Insufficient permissions."); }
function code(error: unknown) { return typeof error === "object" && error !== null && "code" in error ? error.code : undefined; }
async function write<T>(work: () => Promise<T>): Promise<T> {
 try { return await work(); } catch (error) {
 if (code(error) === "P2002") throw new AppError(409, "PROVIDER_CONFLICT", "Provider name or city price already exists. Refresh and retry.");
 if (["P2025", "P2003"].includes(String(code(error)))) throw new AppError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
 throw error;
 }
}
function price<T extends { fee: { toFixed: (places: number) => string } }>(row: T) { return { ...row, fee: row.fee.toFixed(2), currency: "MMK" as const }; }
function provider(row: Awaited<ReturnType<typeof repository.create>>) { return { ...row, cityPrices: row.cityPrices.map(price) }; }
export async function list(actor: Actor) { authorize(actor, "OPERATOR"); return { providers: (await repository.list()).map(provider) }; }
export async function create(actor: Actor, input: CreateProviderInput) { authorize(actor, "OPERATOR"); return provider(await write(() => repository.create(input))); }
export async function update(actor: Actor, id: string, input: UpdateProviderInput) { authorize(actor, "OPERATOR"); return provider(await write(() => repository.update(id, input))); }
export async function putPrice(actor: Actor, id: string, city: string, input: PriceInput) { authorize(actor, "OPERATOR"); return price(await write(() => repository.putPrice(id, city, input))); }
export async function available(actor: Actor, city: string) { authorize(actor, "SME"); return { city, providers: (await repository.available(city)).map(row => ({ id: row.id, name: row.name, deliveryFee: row.cityPrices[0]!.fee.toFixed(2), currency: "MMK" as const })) }; }
