import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { riderProfileSchema, type RiderProfile } from "../types/rider-profile.types";
import { riderProfileFormSchema, type RiderProfileFormValues } from "../schemas/rider-profile.schema";

function parse(value: unknown): RiderProfile {
  const result = z.object({ success: z.literal(true), data: riderProfileSchema }).safeParse(value);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}

export async function getRiderProfile(): Promise<RiderProfile> {
  return parse(await postSessionJson("rider/profile", {}));
}

export async function updateRiderProfile(values: RiderProfileFormValues): Promise<RiderProfile> {
  const parsed = riderProfileFormSchema.parse(values);
  const body = {
    fullName: parsed.fullName.trim(),
    phone: parsed.phone.trim(),
    vehicleType: parsed.vehicleType,
    ...(parsed.vehiclePlateNumber?.trim() ? { vehiclePlateNumber: parsed.vehiclePlateNumber.trim() } : {}),
    ...(parsed.vehicleModel?.trim() ? { vehicleModel: parsed.vehicleModel.trim() } : {}),
    ...(parsed.vehicleColor?.trim() ? { vehicleColor: parsed.vehicleColor.trim() } : {}),
  };
  return parse(await postSessionJson("rider/profile/update", body));
}

export function riderProfileErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign in again to continue.";
    if (error.status === 403 && error.code === "RIDER_PROVIDER_MEMBERSHIP_REQUIRED") return "Your Rider account is not linked to a delivery provider. Contact your Operator to finish setup.";
    if (error.status === 403 && error.code === "RIDER_PROFILE_INCOMPLETE") return "Complete your Rider profile before using delivery features.";
    if (error.status === 403) return "This Rider profile is not available for your account.";
    if (error.status === 400) return "Check the highlighted fields and try again.";
    if (error.status === 413) return "The profile request was too large.";
    if (error.status === 429) return "Too many attempts. Wait a moment and try again.";
    if (error.code === "INVALID_RESPONSE") return "The Rider profile response was unexpected. Refresh and try again.";
    if (error.status === 0 || error.status >= 500) return "We could not reach the Rider service. Your profile was not marked complete. Retry when the connection is available.";
  }
  return "We could not check your Rider profile. Please retry.";
}
