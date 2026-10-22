"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProviders, providerAction, providerError } from "../api/providers.api";
import { useOperatorResource } from "../hooks/use-operator-resource";
import { cityPriceInputSchema, type Provider, type ProviderAction } from "../types/provider.types";

function CityPricing({ provider, save, pending }: { provider: Provider; save: (input: ProviderAction) => Promise<boolean>; pending: boolean }) {
  const [priceId, setPriceId] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(cityPriceInputSchema), defaultValues: { city: "", fee: "", isActive: true } });
  function clear() { setPriceId(null); form.reset({ city: "", fee: "", isActive: true }); }
  return <section className="space-y-4 rounded-xl border bg-card p-5">
    <h2 className="text-lg font-semibold">City Pricing Management</h2>
    {provider.cityPrices.length === 0 ? <p>No city prices yet. Add city pricing to enable coverage for SMEs.</p> :
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">City prices for {provider.name}</caption>
        <thead><tr><th className="p-2">City</th><th>Fixed fee (MMK)</th><th>State</th><th>Actions</th></tr></thead>
        <tbody>{provider.cityPrices.map(row => <tr key={row.id} className="border-t">
          <td className="p-2">{row.city}</td><td>{row.fee}</td><td>{row.isActive ? "Active" : "Inactive"}</td>
          <td className="space-x-2 py-2"><Button type="button" variant="outline" disabled={pending} aria-label={`Edit ${row.city}`} onClick={() => { setPriceId(row.id); form.reset({ city: row.city, fee: row.fee, isActive: row.isActive }); }}>Edit</Button>
            <Button type="button" variant="outline" disabled={pending} aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${row.city}`} onClick={async () => { await save({ action: "update", priceId: row.id, isActive: !row.isActive }); }}>{row.isActive ? "Deactivate" : "Activate"}</Button></td>
        </tr>)}</tbody>
      </table></div>}
    <h3 className="font-medium">{priceId ? "Edit City Pricing" : "Add City Pricing"}</h3>
    <form className="flex flex-wrap items-end gap-3" aria-busy={pending} onSubmit={form.handleSubmit(async input => {
      const saved = await save(priceId ? { action: "update", priceId, ...input } : { action: "create", ...input });
      if (saved) clear();
    })}>
      <label className="space-y-1">City<Input placeholder="Yangon" disabled={pending} {...form.register("city")} /></label>
      <label className="space-y-1">Fixed fee (MMK)<Input inputMode="decimal" placeholder="3500.00" disabled={pending} {...form.register("fee")} /></label>
      <label className="flex items-center gap-2 pb-2"><input type="checkbox" disabled={pending} {...form.register("isActive")} />Active city price</label>
      <Button disabled={pending}>{priceId ? "Save City Pricing" : "Add City Pricing"}</Button>
      {priceId && <Button type="button" variant="outline" disabled={pending} onClick={clear}>Cancel edit</Button>}
      {Object.entries(form.formState.errors).map(([key, error]) => <p role="alert" key={key} className="text-destructive">{error.message}</p>)}
    </form>
  </section>;
}
export function DeliveryProviders() {
  const resource = useOperatorResource("my-provider", getProviders);
  const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  async function save(input: ProviderAction) {
    if (pending) return false;
    setPending(true); setError(null); setNotice(null);
    try { await providerAction(input); resource.retry(); setNotice("City pricing saved."); return true; }
    catch (cause) { setError(providerError(cause)); return false; }
    finally { setPending(false); }
  }
  const provider = resource.data?.provider;
  return <div className="space-y-6"><header><h1 className="text-2xl font-semibold">My Delivery Provider</h1><p className="text-muted-foreground">Manage city coverage and fixed MMK fees for your provider. Saved order fees remain unchanged.</p></header>
    {(error || resource.error) && <div role="alert" className="text-destructive">{error || resource.error}<Button type="button" variant="outline" onClick={() => { setError(null); resource.retry(); }}>Retry</Button></div>}
    {notice && <p role="status">{notice}</p>}
    {resource.isLoading && <p role="status">Loading your provider…</p>}
    {resource.data && !provider && <p role="status">Your delivery provider has not been configured.</p>}
    {provider && <><section className="rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">{provider.name}</h2><p>{provider.isActive ? "Active provider" : "Inactive provider — SME discovery is disabled."}</p></section>
      <CityPricing key={provider.id} provider={provider} save={save} pending={pending} /></>}
  </div>;
}
