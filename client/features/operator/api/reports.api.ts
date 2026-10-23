import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import { reportOverviewSchema, reportQuerySchema, type ReportQuery } from "../types/report.types";

export async function getReportOverview(query: ReportQuery) {
  const payload = await postSessionJson("operator/reports/overview", reportQuerySchema.parse(query));
  const result = z.object({ success: z.literal(true), data: reportOverviewSchema }).safeParse(payload);
  if (!result.success) throw new ApiError(502, "INVALID_RESPONSE");
  return result.data.data;
}
export function reportError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign in again.";
    if (error.status === 403) return "You do not have permission to view delivery reports.";
    if (error.status === 409) return "Your Operator provider is not configured.";
    if (error.status === 400) return "Choose a valid reporting period.";
  }
  return "Reports could not be loaded. Check your connection and try again.";
}
