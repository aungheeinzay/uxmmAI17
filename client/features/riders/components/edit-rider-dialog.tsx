"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { riderProfileFormSchema, vehicleRequiresPlate, vehicleTypeOptions, type RiderProfileFormValues } from "@/features/rider-profile/schemas/rider-profile.schema";
import { riderMutationError, updateManagedRider } from "../api/rider-management.api";
import type { ManagedRider } from "../types/rider-management.types";

export function EditRiderDialog({ rider, onClose, onSaved }: { rider: ManagedRider; onClose: () => void; onSaved: (rider: ManagedRider) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [vehicleType, setVehicleType] = useState<RiderProfileFormValues["vehicleType"]>(rider.vehicle.type ?? "MOTORCYCLE");
  const form = useForm<RiderProfileFormValues>({
    resolver: zodResolver(riderProfileFormSchema),
    shouldUnregister: true,
    defaultValues: {
      fullName: rider.fullName ?? "",
      phone: rider.phone ?? "",
      vehicleType: rider.vehicle.type ?? "MOTORCYCLE",
      vehiclePlateNumber: rider.vehicle.plateNumber ?? "",
      vehicleModel: rider.vehicle.model ?? "",
      vehicleColor: rider.vehicle.color ?? "",
    },
  });
  const plateRequired = vehicleRequiresPlate(vehicleType);
  const { errors } = form.formState;

  async function submit(values: RiderProfileFormValues) {
    setPending(true); setError(null);
    try {
      const saved = await updateManagedRider(rider.id, values);
      onSaved(saved);
    } catch (cause) {
      setError(riderMutationError(cause));
    } finally {
      setPending(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent aria-describedby="edit-rider-description">
    <DialogTitle>Edit Rider</DialogTitle>
    <DialogDescription id="edit-rider-description">Update the Rider&apos;s permitted profile and vehicle details. Account identity, provider and delivery history are read-only.</DialogDescription>
    <form noValidate className="space-y-4" aria-busy={pending} onSubmit={form.handleSubmit(submit)}>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="managed-rider-name">Full name</Label>
        <Input id="managed-rider-name" autoComplete="name" disabled={pending} aria-invalid={!!errors.fullName} aria-describedby={errors.fullName ? "managed-rider-name-error" : undefined} {...form.register("fullName")} />
        {errors.fullName && <p id="managed-rider-name-error" role="alert" className="text-sm text-destructive">{errors.fullName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="managed-rider-phone">Phone number</Label>
        <Input id="managed-rider-phone" type="tel" inputMode="tel" autoComplete="tel" disabled={pending} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "managed-rider-phone-error" : undefined} {...form.register("phone")} />
        {errors.phone && <p id="managed-rider-phone-error" role="alert" className="text-sm text-destructive">{errors.phone.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="managed-rider-vehicle-type">Vehicle type</Label>
        <select id="managed-rider-vehicle-type" disabled={pending} aria-invalid={!!errors.vehicleType} className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-input/50 md:text-sm" {...form.register("vehicleType", { onChange: event => setVehicleType(event.target.value as RiderProfileFormValues["vehicleType"]) })}>
          {vehicleTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {errors.vehicleType && <p role="alert" className="text-sm text-destructive">{errors.vehicleType.message}</p>}
      </div>
      {plateRequired && <div className="space-y-2">
        <Label htmlFor="managed-rider-plate">Vehicle plate number</Label>
        <Input id="managed-rider-plate" autoCapitalize="characters" autoComplete="off" placeholder="e.g. ABC-123" disabled={pending} aria-invalid={!!errors.vehiclePlateNumber} aria-describedby={errors.vehiclePlateNumber ? "managed-rider-plate-error" : undefined} {...form.register("vehiclePlateNumber")} />
        {errors.vehiclePlateNumber && <p id="managed-rider-plate-error" role="alert" className="text-sm text-destructive">{errors.vehiclePlateNumber.message}</p>}
      </div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="managed-rider-model">Vehicle model <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="managed-rider-model" disabled={pending} aria-invalid={!!errors.vehicleModel} {...form.register("vehicleModel")} />
          {errors.vehicleModel && <p role="alert" className="text-sm text-destructive">{errors.vehicleModel.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="managed-rider-color">Vehicle color <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="managed-rider-color" disabled={pending} aria-invalid={!!errors.vehicleColor} {...form.register("vehicleColor")} />
          {errors.vehicleColor && <p role="alert" className="text-sm text-destructive">{errors.vehicleColor.message}</p>}
        </div>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
        <p>{rider.email ?? "No email account"} · {rider.provider.name}</p>
        <p>Plate is required for motorcycles, cars and vans. Profile completion is recalculated from the saved values.</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving Rider..." : "Save Rider"}</Button>
      </div>
    </form>
  </DialogContent></Dialog>;
}
