import type { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../../lib/errors/app-error";
import * as repository from "./rider-profile.repository";
import { vehicleRequiresPlate, type RiderProfileUpdateInput } from "./rider-profile.validation";

type Actor = { id: string; role: Role };
type CompletionSource = Pick<repository.RiderProfileRow, "role" | "fullName" | "phone" | "providerId" | "riderProfile">;

export function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizePlate(value: string | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, " ").toUpperCase();
  return trimmed ? trimmed : null;
}

// Completion is always derived from persisted/server-accepted values.
export function missingFields(profile: CompletionSource): string[] {
  const missing: string[] = [];
  if (!profile.fullName?.trim()) missing.push("fullName");
  if (!profile.phone?.trim()) missing.push("phone");
  const vehicle = profile.riderProfile;
  if (!vehicle?.vehicleType) missing.push("vehicleType");
  else if (vehicleRequiresPlate(vehicle.vehicleType) && !vehicle.vehiclePlateNumber?.trim()) missing.push("vehiclePlateNumber");
  if (!profile.providerId) missing.push("provider");
  return missing;
}

export function isProfileComplete(profile: CompletionSource) {
  return profile.role === "RIDER" && missingFields(profile).length === 0;
}

function serialize(profile: repository.RiderProfileRow) {
  const missing = missingFields(profile);
  const profileComplete = profile.role === "RIDER" && missing.length === 0;
  return {
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.account?.email ?? null,
    provider: profile.provider,
    vehicle: {
      type: profile.riderProfile?.vehicleType ?? null,
      plateNumber: profile.riderProfile?.vehiclePlateNumber ?? null,
      model: profile.riderProfile?.vehicleModel ?? null,
      color: profile.riderProfile?.vehicleColor ?? null,
    },
    profileComplete,
    missingFields: missing,
    // Never report a completion timestamp for a profile that no longer satisfies the rules.
    completedAt: profileComplete ? profile.riderProfile?.completedAt?.toISOString() ?? null : null,
  };
}

export async function getRiderProfile(actor: Actor) {
  if (actor.role !== "RIDER") throw new AppError(403, "FORBIDDEN", "Only Riders may access a Rider profile.");
  const profile = await repository.findRiderProfile(actor.id);
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  return serialize(profile);
}

export async function updateRiderProfile(actor: Actor, input: RiderProfileUpdateInput) {
  if (actor.role !== "RIDER") throw new AppError(403, "FORBIDDEN", "Only Riders may update a Rider profile.");
  const identity = { fullName: input.fullName.trim(), phone: input.phone.trim() };
  const vehicle = {
    vehicleType: input.vehicleType,
    vehiclePlateNumber: normalizePlate(input.vehiclePlateNumber),
    vehicleModel: normalizeOptional(input.vehicleModel),
    vehicleColor: normalizeOptional(input.vehicleColor),
  };
  const saved = await repository.transaction(async tx => {
    const current = await repository.findProfile(tx, actor.id);
    if (!current) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
    if (current.role !== "RIDER") throw new AppError(403, "FORBIDDEN", "Only Riders may update a Rider profile.");
    const complete = missingFields({
      ...current,
      ...identity,
      riderProfile: { ...vehicle, completedAt: current.riderProfile?.completedAt ?? null },
    }).length === 0;
    // Keep the first completion timestamp while complete; clear it when required data is removed.
    const completedAt = complete ? current.riderProfile?.completedAt ?? new Date() : null;
    await repository.updateIdentity(tx, actor.id, identity);
    await repository.saveVehicle(tx, actor.id, { ...vehicle, completedAt });
    return repository.findProfile(tx, actor.id);
  });
  if (!saved) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  return serialize(saved);
}

// Reusable delivery guard. Provider membership is a distinct configuration state.
export async function assertRiderProfileComplete(actorId: string) {
  const profile = await repository.findRiderProfile(actorId);
  if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found.");
  if (profile.deactivatedAt) {
    throw new AppError(403, "RIDER_DEACTIVATED", "This Rider account is inactive. Contact your Operator.");
  }
  if (!profile.providerId) {
    throw new AppError(403, "RIDER_PROVIDER_MEMBERSHIP_REQUIRED", "Your Rider account is not linked to a delivery provider. Contact your Operator to finish setup.");
  }
  const missing = missingFields(profile);
  if (!isProfileComplete(profile)) {
    throw new AppError(403, "RIDER_PROFILE_INCOMPLETE", `Complete your Rider profile before delivery operations. Missing: ${missing.join(", ")}.`);
  }
}
