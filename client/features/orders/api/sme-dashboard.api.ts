import { ApiError, postSessionJson } from "@/lib/api-client";
import { smeDashboardResponseSchema } from "../schemas/sme-dashboard.schema";

export async function getSmeDashboard() {
  const result = smeDashboardResponseSchema.safeParse(await postSessionJson("sme/dashboard", {}));
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}