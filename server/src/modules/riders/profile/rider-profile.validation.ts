import { z } from "zod";
import { VehicleType } from "../../../generated/prisma/enums";

// Registered motor vehicles need a plate. Bicycles and on-foot riders do not.
export const plateRequiredVehicleTypes = ["MOTORCYCLE", "CAR", "VAN"] as const;
export function vehicleRequiresPlate(type: string | null | undefined) {
  return type !== null && type !== undefined && (plateRequiredVehicleTypes as readonly string[]).includes(type);
}

export const riderProfileUpdateSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(120, "Use no more than 120 characters."),
  phone: z.string().trim().min(1, "Enter your phone number.").max(32, "Use no more than 32 characters."),
  vehicleType: z.enum(VehicleType),
  vehiclePlateNumber: z.string().trim().min(1, "Enter the vehicle plate number.").max(32, "Use no more than 32 characters.").optional(),
  vehicleModel: z.string().trim().max(120, "Use no more than 120 characters.").optional(),
  vehicleColor: z.string().trim().max(64, "Use no more than 64 characters.").optional(),
}).strict().refine(value => !vehicleRequiresPlate(value.vehicleType) || Boolean(value.vehiclePlateNumber), {
  path: ["vehiclePlateNumber"],
  message: "A plate number is required for motorcycles, cars and vans.",
});

export type RiderProfileUpdateInput = z.infer<typeof riderProfileUpdateSchema>;
