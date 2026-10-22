import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { riderProfileFormSchema, type RiderProfileFormValues } from "@/features/rider-profile/schemas/rider-profile.schema";
import { dashboardSchema, managementDetailSchema, managementRequestSchema, riderMutationSchema, type ManagedRider, type ManagedRiderUpdateInput } from "../types/rider-management.types";
async function read<T extends z.ZodType>(key: string, schema: T): Promise<z.infer<T>> {
  const input = managementRequestSchema.parse(JSON.parse(key));
  const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(await postSessionJson("operator/rider-management", input));
  if (!envelope.success) throw new ApiError(502, "INVALID_RESPONSE");
  const result = schema.safeParse(envelope.data.data);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data;
}
async function mutate(body: unknown): Promise<ManagedRider> {
  const parsed = managementRequestSchema.parse(body);
  const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(await postSessionJson("operator/rider-management", parsed));
  if (!envelope.success) throw new ApiError(502, "INVALID_RESPONSE");
  const result = riderMutationSchema.safeParse(envelope.data.data);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.rider;
}
function updateInput(values: RiderProfileFormValues): ManagedRiderUpdateInput {
  const parsed = riderProfileFormSchema.parse(values);
  return {
    fullName: parsed.fullName.trim(),
    phone: parsed.phone.trim(),
    vehicleType: parsed.vehicleType,
    ...(parsed.vehiclePlateNumber?.trim() ? { vehiclePlateNumber: parsed.vehiclePlateNumber.trim() } : {}),
    ...(parsed.vehicleModel?.trim() ? { vehicleModel: parsed.vehicleModel.trim() } : {}),
    ...(parsed.vehicleColor?.trim() ? { vehicleColor: parsed.vehicleColor.trim() } : {}),
  };
}
export const getRiderDashboard = (key: string) => read(key, dashboardSchema);
export const getManagedRider = (key: string) => read(key, managementDetailSchema);
export function updateManagedRider(id: string, values: RiderProfileFormValues) {
  return mutate({ action: "update", id, input: updateInput(values) });
}
export function deactivateManagedRider(id: string) {
  return mutate({ action: "deactivate", id });
}
export function reactivateManagedRider(id: string) {
  return mutate({ action: "reactivate", id });
}
export function riderManagementError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "PROVIDER_MEMBERSHIP_REQUIRED") return "Your delivery provider has not been configured.";
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "Only Operators can manage Riders.";
    if (error.status === 404) return "Rider not found in your provider.";
  }
  return "Unable to load Rider management. Check your connection and retry.";
}
export function riderMutationError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "RIDER_HAS_ACTIVE_ASSIGNMENTS") return "This Rider still has active assignments. Resolve or safely reassign them before deactivating.";
    if (error.code === "RIDER_DEACTIVATION_CONFLICT" || error.code === "RIDER_REACTIVATION_CONFLICT") return "The Rider status changed while you were working. Refresh and try again.";
    if (error.code === "RIDER_NOT_FOUND" || error.status === 404) return "Rider not found in your provider. Refresh the list.";
    if (error.code === "PROVIDER_MEMBERSHIP_REQUIRED") return "Your delivery provider has not been configured.";
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "Only Operators can manage Riders.";
    if (error.status === 400) return "Check the highlighted Rider details and try again. A plate is required for motorcycles, cars and vans.";
    if (error.code === "INVALID_RESPONSE") return "The Rider service returned an unexpected response. Refresh and try again.";
    if (error.status === 0 || error.status >= 500) return "We could not reach the Rider service. No changes were confirmed. Retry when the connection is available.";
  }
  return "We could not update this Rider. Check your connection and retry.";
}
