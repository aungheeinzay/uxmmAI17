import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { assignmentSchema, assignmentDetailSchema, assignmentListSchema, eligibleRidersSchema, createAssignmentSchema, deliveryQuerySchema, parcelScanRequestSchema, riderAssignmentListSchema, riderDeliveryQuerySchema, statusRequestSchema, type DeliveryQuery, type RiderDeliveryQuery } from "../types/delivery.types";
async function call<T extends z.ZodType>(path: string, body: unknown, schema: T): Promise<z.infer<T>> {
  const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(await postSessionJson(path, body));
  if (!envelope.success) throw new ApiError(502, "INVALID_RESPONSE");
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) throw new ApiError(502, "INVALID_RESPONSE");
  return parsed.data;
}
export const getEligibleRiders = (query: DeliveryQuery) => call("operator/riders", deliveryQuerySchema.parse(query), eligibleRidersSchema);
export const getAssignments = (query: DeliveryQuery) => call("operator/assignments", deliveryQuerySchema.parse(query), assignmentListSchema);
export const getMyAssignments = (query: RiderDeliveryQuery) => call("rider/assignments", riderDeliveryQuerySchema.parse(query), riderAssignmentListSchema);
export const getMyAssignment = (id: string) => call("rider/assignments/detail", { id: z.string().uuid().parse(id) }, assignmentDetailSchema);
export const verifyParcelScan = (input: { qrData: string }) => call("rider/parcel-scans/verify", parcelScanRequestSchema.parse(input), assignmentDetailSchema);
export const assignParcel = (input: z.infer<typeof createAssignmentSchema>) => call("operator/assignments/create", createAssignmentSchema.parse(input), assignmentSchema);
export const updateDelivery = (input: z.infer<typeof statusRequestSchema>) => call("rider/assignments/status", statusRequestSchema.parse(input), assignmentDetailSchema.extend({ previousStatus: z.string() }));
export function deliveryError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403 && error.code === "RIDER_PROFILE_INCOMPLETE") return "Complete your Rider profile before using deliveries.";
    if (error.status === 403 && error.code === "RIDER_PROVIDER_MEMBERSHIP_REQUIRED") return "Your Rider account is not linked to a delivery provider. Contact your Operator to finish setup.";
    if (error.status === 403) return "You do not have permission for this delivery action.";
    if (error.status === 404 && error.code === "RIDER_NOT_ELIGIBLE") return "An activated Rider account was not found.";
    if (error.status === 404) return "The parcel, assignment or eligible Rider was not found. Refresh and try again.";
    if (error.status === 409) return "The parcel may already be assigned or its status changed. Data is being refreshed; check before trying again.";
    if (error.status === 400) return "Check the selected Rider, status and failure reason.";
    if (error.status === 429) return "Too many requests. Wait a moment and try again.";
    if (error.status >= 500) return "The delivery service is unavailable. Refresh before trying again.";
  }
  return "Could not reach the delivery service. Check your connection and refresh before retrying.";
}
