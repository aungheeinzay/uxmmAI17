import { z } from "zod";
import { vehicleTypeSchema } from "../types/rider-profile.types";

// Mirrors the Express rules so the form fails fast, but the backend remains authoritative.
export const riderProfileFormSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(120, "Use no more than 120 characters."),
  phone: z.string().trim().min(1, "Enter your phone number.").max(32, "Use no more than 32 characters."),
  vehicleType: vehicleTypeSchema,
  vehiclePlateNumber: z.string().trim().max(32, "Use no more than 32 characters.").optional(),
  vehicleModel: z.string().trim().max(120, "Use no more than 120 characters.").optional(),
  vehicleColor: z.string().trim().max(64, "Use no more than 64 characters.").optional(),
}).refine(value => !["MOTORCYCLE", "CAR", "VAN"].includes(value.vehicleType) || Boolean(value.vehiclePlateNumber?.trim()), {
  path: ["vehiclePlateNumber"],
  message: "A plate number is required for motorcycles, cars and vans.",
});

export type RiderProfileFormValues = z.infer<typeof riderProfileFormSchema>;

export const vehicleTypeOptions = [
  { value: "MOTORCYCLE", label: "Motorcycle", requiresPlate: true },
  { value: "CAR", label: "Car", requiresPlate: true },
  { value: "VAN", label: "Van", requiresPlate: true },
  { value: "BICYCLE", label: "Bicycle", requiresPlate: false },
  { value: "ON_FOOT", label: "On foot", requiresPlate: false },
] as const;

export function vehicleRequiresPlate(type: string | null | undefined) {
  return type === "MOTORCYCLE" || type === "CAR" || type === "VAN";
}
