import { z } from "zod";
import { ApiError, postJson, postSessionJson } from "@/lib/api-client";
import { invitationRequestSchema, type InviteRiderValues } from "../schemas/rider.schema";
export const invitationResponseSchema = z.object({ success: z.literal(true), data: z.object({ message: z.string(), invitation: z.object({ id: z.string().uuid(), email: z.string().email(), expiresAt: z.string().datetime(), status: z.literal("pending") }) }) });
export async function inviteRider(values: InviteRiderValues) {
 const result = invitationResponseSchema.safeParse(await postSessionJson("riders/invitations", invitationRequestSchema.parse(values)));
 if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
 return result.data.data;
}
export async function activateRider(token: string, password: string) {
 const result = z.object({ success: z.literal(true), data: z.object({ message: z.string() }) }).safeParse(await postJson("/api/riders/activate", { token, password }));
 if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
}
export function riderErrorMessage(error: unknown, activating = false) {
 if (error instanceof ApiError) {
  if (error.code === "PROVIDER_MEMBERSHIP_REQUIRED") return "Your delivery provider has not been configured.";
  if (error.code === "INVALID_INVITATION_TOKEN") return "This invitation is invalid, expired, or already used. Ask your Operator for a new invitation.";
  if (error.status === 401) return "Your session has expired. Sign in again.";
  if (error.status === 403) return "Only Operators can invite Riders. Sign in with an Operator account.";
  if (error.status === 409) return "An account or pending invitation already exists for this email. Try signing in or contact your Operator.";
  if (error.status === 429) return "Too many requests. Wait 15 minutes and try again.";
  if (error.code === "EMAIL_DELIVERY_FAILED") return "The invitation email could not be delivered. Please try again.";
  if (error.status === 400) return "Check your details and try again.";
  if (error.code === "OFFLINE") return "You appear to be offline. Reconnect and try again.";
 }
 return activating ? "Activation could not be confirmed. Try signing in before retrying this link." : "Invitation could not be confirmed. Check with the Rider before retrying.";
}
