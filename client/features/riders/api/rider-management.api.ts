import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { dashboardSchema, managementDetailSchema, managementRequestSchema } from "../types/rider-management.types";
async function read<T extends z.ZodType>(key: string, schema: T): Promise<z.infer<T>> {
  const input = managementRequestSchema.parse(JSON.parse(key));
  const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(await postSessionJson("operator/rider-management", input));
  if (!envelope.success) throw new ApiError(502, "INVALID_RESPONSE");
  const result = schema.safeParse(envelope.data.data);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data;
}
export const getRiderDashboard = (key: string) => read(key, dashboardSchema);
export const getManagedRider = (key: string) => read(key, managementDetailSchema);
export function riderManagementError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "PROVIDER_MEMBERSHIP_REQUIRED") return "Your delivery provider has not been configured.";
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403) return "Only Operators can manage Riders.";
    if (error.status === 404) return "Rider not found in your provider.";
  }
  return "Unable to load Rider management. Check your connection and retry.";
}
