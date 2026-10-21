import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { authUserSchema } from "@/features/auth/schemas/auth.schema";
import { profileUpdateSchema, type ProfileFormValues } from "../schemas/profile.schema";
export async function updateProfile(values: ProfileFormValues) {
 const body = profileUpdateSchema.parse({ fullName: values.fullName.trim() || null, phone: values.phone.trim() || null });
 const result = z.object({ success: z.literal(true), data: z.object({ user: authUserSchema }) }).safeParse(await postSessionJson("profile", body));
 if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
 return result.data.data.user;
}
export function profileErrorMessage(error: unknown) {
 if (error instanceof ApiError) {
  if (error.status === 401) return "Your session has expired. Sign in again to save your profile.";
  if (error.status === 403) return "This profile request was blocked. Refresh the page and try again.";
  if (error.status === 400) return "Check your name and phone number and try again.";
  if (error.status === 429) return "Too many requests. Please wait and try again.";
 }
 return "We could not confirm the update. Reload your profile before trying again.";
}
