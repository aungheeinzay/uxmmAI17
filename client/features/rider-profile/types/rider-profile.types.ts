import { z } from "zod";

export const vehicleTypeSchema = z.enum(["MOTORCYCLE", "BICYCLE", "CAR", "VAN", "ON_FOOT"]);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const riderVehicleSchema = z.object({
  type: vehicleTypeSchema.nullable(),
  plateNumber: z.string().nullable(),
  model: z.string().nullable(),
  color: z.string().nullable(),
});
export type RiderVehicle = z.infer<typeof riderVehicleSchema>;

export const riderProfileSchema = z.object({
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  provider: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  vehicle: riderVehicleSchema,
  profileComplete: z.boolean(),
  missingFields: z.array(z.string()),
  completedAt: z.iso.datetime().nullable(),
});
export type RiderProfile = z.infer<typeof riderProfileSchema>;

// Server-bound shape for the BFF. Optional empty values are omitted by the API layer.
export const riderProfileUpdateRequestSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(32),
  vehicleType: vehicleTypeSchema,
  vehiclePlateNumber: z.string().trim().min(1).max(32).optional(),
  vehicleModel: z.string().trim().max(120).optional(),
  vehicleColor: z.string().trim().max(64).optional(),
}).strict().refine(value => !["MOTORCYCLE", "CAR", "VAN"].includes(value.vehicleType) || Boolean(value.vehiclePlateNumber), {
  path: ["vehiclePlateNumber"],
  message: "A plate number is required for motorcycles, cars and vans.",
});
export type RiderProfileUpdateRequest = z.infer<typeof riderProfileUpdateRequestSchema>;
