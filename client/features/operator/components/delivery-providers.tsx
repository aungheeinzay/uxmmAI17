"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProviders, providerAction, providerError } from "../api/providers.api";
import { useOperatorResource } from "../hooks/use-operator-resource";
import { cityPriceInputSchema, providerNameSchema, type Provider, type ProviderAction } from "../types/provider.types";
const nameSchema = z.object({ name: providerNameSchema });
const editSchema = nameSchema.extend({ isActive: z.boolean() });
function ProviderEditor({ provider, save, pending }: { provider: Provider; save: (input: ProviderAction) => Promise<boolean>; pending: boolean }) {
  const edit = useForm({ resolver: zodResolver(editSchema), defaultValues: { name: provider.name, isActive: provider.isActive } });
  const price = useForm({ resolver: zodResolver(cityPriceInputSchema), defaultValues: { city: "", fee: "", isActive: true } });
  return <section aria-label={provider.name} className="space-y-4 rounded-xl border bg-card p-5">
    <form className="flex flex-wrap items-end gap-3" onSubmit={edit.handleSubmit(async input => { await save({ action: "update", id: provider.id, ...input }); })}>
      <label className="space-y-1">Provider name<Input {...edit.register("name")} /></label>
      <label className="flex items-center gap-2 pb-2"><input type="checkbox" {...edit.register("isActive")} />Active provider</label>
      <Button disabled={pending}>Save provider</Button>
      {edit.formState.errors.name && <p role="alert" className="text-destructive">{edit.formState.errors.name.message}</p>}
    </form>
    <p className="text-sm text-muted-foreground">{provider.isActive ? "Active" : "Inactive"} · Fixed delivery fees in MMK</p>
    {provider.cityPrices.length === 0 ? <p>No city prices yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">City prices for {provider.name}</caption><thead><tr><th className="p-2">City</th><th>Fee (MMK)</th><th>State</th><th>Manage</th></tr></thead><tbody>{provider.cityPrices.map(row => <tr key={row.id} className="border-t"><td className="p-2">{row.city}</td><td>{row.fee}</td><td>{row.isActive ? "Active" : "Inactive"}</td><td><Button type="button" variant="outline" disabled={pending} onClick={() => price.reset({ city: row.city, fee: row.fee, isActive: row.isActive })}>Edit city price</Button></td></tr>)}</tbody></table></div>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={price.handleSubmit(async input => { if (await save({ action: "price", id: provider.id, ...input })) price.reset(); })}>
      <label className="space-y-1">City<Input placeholder="Yangon" {...price.register("city")} /></label>
      <label className="space-y-1">Fixed fee (MMK)<Input inputMode="decimal" placeholder="3500.00" {...price.register("fee")} /></label>
      <label className="flex items-center gap-2 pb-2"><input type="checkbox" {...price.register("isActive")} />Active city price</label>
      <Button disabled={pending}>Save city price</Button>
      {Object.entries(price.formState.errors).map(([key, error]) => <p role="alert" key={key} className="text-destructive">{error.message}</p>)}
    </form>
  </section>;
}
export function DeliveryProviders() {
  const resource = useOperatorResource("delivery-providers", getProviders);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(nameSchema), defaultValues: { name: "" } });
  async function save(input: ProviderAction) {
    if (pending) return false;
    setPending(true); setError(null); setNotice(null);
    try { await providerAction(input); resource.retry(); setNotice("Provider pricing saved."); return true; }
    catch (cause) { setError(providerError(cause)); return false; }
    finally { setPending(false); }
  }
  return <div className="space-y-6"><header><h1 className="text-2xl font-semibold">Delivery Providers</h1><p className="text-muted-foreground">Manage city coverage and fixed delivery fees. Saved order fees remain unchanged.</p></header>
    <form className="flex flex-wrap items-end gap-3" onSubmit={form.handleSubmit(async input => { if (await save({ action: "create", ...input })) form.reset(); })}>
      <label className="space-y-1">New provider name<Input {...form.register("name")} /></label><Button disabled={pending}>Create provider</Button>
      {form.formState.errors.name && <p role="alert" className="text-destructive">{form.formState.errors.name.message}</p>}
    </form>
    {(error || resource.error) && <div role="alert" className="text-destructive">{error || resource.error}<Button type="button" variant="outline" onClick={resource.retry}>Retry</Button></div>}
    {notice && <p role="status">{notice}</p>}
    {resource.isLoading && <p role="status">Loading providers…</p>}
    {resource.data?.providers.length === 0 && <p>No providers yet. Create one and add a city price to make it available to SMEs.</p>}
    {resource.data?.providers.map(provider => <ProviderEditor key={`${provider.id}:${provider.updatedAt}:${provider.cityPrices.map(row => row.updatedAt).join()}`} provider={provider} save={save} pending={pending} />)}
  </div>;
}
