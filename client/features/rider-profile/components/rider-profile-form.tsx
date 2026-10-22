"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, CheckCircle2, LoaderCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRiderProfile } from "../hooks/use-rider-profile";
import { useSaveRiderProfile } from "../hooks/use-save-rider-profile";
import { riderProfileFormSchema, vehicleRequiresPlate, vehicleTypeOptions, type RiderProfileFormValues } from "../schemas/rider-profile.schema";
import type { RiderProfile } from "../types/rider-profile.types";
import { ProviderSetupRequired } from "./provider-setup-required";
import { RiderAvatar } from "./rider-avatar";

const missingLabels: Record<string, string> = {
  fullName: "Full name",
  phone: "Phone number",
  vehicleType: "Vehicle type",
  vehiclePlateNumber: "Plate number",
  provider: "Delivery provider",
};

function ReadOnlyField({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} readOnly value={value} className="bg-muted/50" />
    </div>
  );
}

export function RiderProfileForm() {
  const state = useRiderProfile();
  if (state.isLoading) {
    return (
      <p role="status" className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        Loading your Rider profile…
      </p>
    );
  }
  if (state.error) {
    return (
      <div role="alert" className="space-y-4 rounded-2xl border bg-card p-5">
        <p className="font-medium">We couldn’t load your Rider profile</p>
        <p className="text-sm text-muted-foreground">{state.error}</p>
        <Button variant="outline" onClick={state.retry} className="min-h-11"><RefreshCw aria-hidden="true" />Retry</Button>
      </div>
    );
  }
  if (!state.profile) return <p role="alert" className="py-10 text-sm">Your Rider profile is unavailable. Sign in again or contact your Operator.</p>;
  return <RiderProfileEditor profile={state.profile} />;
}

function RiderProfileEditor({ profile }: { profile: RiderProfile }) {
  const router = useRouter();
  const save = useSaveRiderProfile();
  const [saved, setSaved] = useState<RiderProfile | null>(null);
  const form = useForm<RiderProfileFormValues>({
    resolver: zodResolver(riderProfileFormSchema),
    shouldUnregister: true,
    defaultValues: {
      fullName: profile.fullName ?? "",
      phone: profile.phone ?? "",
      vehicleType: profile.vehicle.type ?? "MOTORCYCLE",
      vehiclePlateNumber: profile.vehicle.plateNumber ?? "",
      vehicleModel: profile.vehicle.model ?? "",
      vehicleColor: profile.vehicle.color ?? "",
    },
  });
  const [vehicleType, setVehicleType] = useState<RiderProfileFormValues["vehicleType"]>(profile.vehicle.type ?? "MOTORCYCLE");
  const plateRequired = vehicleRequiresPlate(vehicleType);
  const { errors } = form.formState;

  async function onSubmit(values: RiderProfileFormValues) {
    const result = await save.submit(values);
    if (!result) return;
    setSaved(result);
    if (result.profileComplete && result.provider) router.replace("/rider");
  }

  const stillMissing = saved?.missingFields.map(field => missingLabels[field] ?? field) ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <p className="text-sm font-medium text-primary">Rider onboarding</p>
        <h1 className="text-2xl font-bold tracking-tight">Complete Your Rider Profile</h1>
        <p className="text-sm text-muted-foreground">Tell us who you are and what you ride so your delivery work can begin.</p>
      </section>

      {!profile.provider && <ProviderSetupRequired />}

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Your account identity comes from your Operator invitation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex items-center gap-4 rounded-xl border border-dashed p-4">
            <RiderAvatar name={profile.fullName} className="size-16 text-xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">Profile photo</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Optional</span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Camera aria-hidden="true" className="size-3.5" />Photo upload is not available in this phase.</p>
            </div>
          </div>

          <form noValidate className="space-y-5" aria-busy={save.isPending} onSubmit={form.handleSubmit(onSubmit)}>
            {save.error && <Alert variant="destructive"><AlertDescription>{save.error}</AlertDescription></Alert>}
            {saved?.profileComplete && <Alert className="border-emerald-300 bg-emerald-50 text-emerald-950 *:[svg]:text-emerald-700"><CheckCircle2 aria-hidden="true" /><AlertTitle>Rider profile complete</AlertTitle><AlertDescription className="text-emerald-900">Taking you to My Deliveries…</AlertDescription></Alert>}
            {saved && !saved.profileComplete && stillMissing.length > 0 && <Alert className="border-amber-300 bg-amber-50 text-amber-950"><AlertTitle>Profile saved, but setup is incomplete</AlertTitle><AlertDescription className="text-amber-900">Still needed: {stillMissing.join(", ")}.{!saved.provider && " Ask your Operator to link your delivery provider."}</AlertDescription></Alert>}

            <div className="space-y-2">
              <Label htmlFor="rider-full-name">Full name</Label>
              <Input id="rider-full-name" autoComplete="name" disabled={save.isPending} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "rider-full-name-error" : undefined} {...form.register("fullName")} />
              {errors.fullName && <p id="rider-full-name-error" role="alert" className="text-sm text-destructive">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rider-phone">Phone number</Label>
              <Input id="rider-phone" type="tel" inputMode="tel" autoComplete="tel" disabled={save.isPending} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "rider-phone-error" : undefined} {...form.register("phone")} />
              {errors.phone && <p id="rider-phone-error" role="alert" className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <ReadOnlyField id="rider-email" label="Email address" value={profile.email ?? "Unavailable"} />
              <ReadOnlyField id="rider-provider" label="Delivery provider" value={profile.provider?.name ?? "Not linked by Operator"} />
            </div>
            <ReadOnlyField id="rider-service-type" label="Service type" value="Delivery Service Agent" />

            <div className="space-y-2">
              <Label htmlFor="rider-vehicle-type">Vehicle type</Label>
              <select
                id="rider-vehicle-type"
                disabled={save.isPending}
                aria-invalid={!!errors.vehicleType}
                className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-input/50 md:text-sm"
                {...form.register("vehicleType", { onChange: event => setVehicleType(event.target.value as RiderProfileFormValues["vehicleType"]) })}
              >
                {vehicleTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {errors.vehicleType && <p role="alert" className="text-sm text-destructive">{errors.vehicleType.message}</p>}
            </div>

            {plateRequired && (
              <div className="space-y-2">
                <Label htmlFor="rider-plate">Vehicle plate number</Label>
                <Input id="rider-plate" autoCapitalize="characters" autoComplete="off" placeholder="e.g. ABC-123" disabled={save.isPending} aria-invalid={!!errors.vehiclePlateNumber} aria-describedby={errors.vehiclePlateNumber ? "rider-plate-error" : undefined} {...form.register("vehiclePlateNumber")} />
                {errors.vehiclePlateNumber && <p id="rider-plate-error" role="alert" className="text-sm text-destructive">{errors.vehiclePlateNumber.message}</p>}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rider-model">Vehicle model <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="rider-model" disabled={save.isPending} aria-invalid={!!errors.vehicleModel} {...form.register("vehicleModel")} />
                {errors.vehicleModel && <p role="alert" className="text-sm text-destructive">{errors.vehicleModel.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rider-color">Vehicle color <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id="rider-color" disabled={save.isPending} aria-invalid={!!errors.vehicleColor} {...form.register("vehicleColor")} />
                {errors.vehicleColor && <p role="alert" className="text-sm text-destructive">{errors.vehicleColor.message}</p>}
              </div>
            </div>

            <Button type="submit" className="min-h-12 w-full text-base" disabled={save.isPending}>
              {save.isPending ? <><LoaderCircle aria-hidden="true" className="animate-spin" />Saving profile…</> : "Save and Continue"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Name, phone, vehicle type and a plate number for cars, vans and motorcycles are required. This is not identity verification.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
