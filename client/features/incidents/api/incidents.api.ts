import { z } from "zod";
import { ApiError, postSessionJson } from "@/lib/api-client";
import {
  incidentListSchema, incidentQuerySchema, incidentSchema, reportIncidentSchema, reviewIncidentSchema,
  type IncidentQuery,
} from "../types/incident.types";

async function call<T extends z.ZodType>(path: string, body: unknown, schema: T): Promise<z.infer<T>> {
  const envelope = z.object({ success: z.literal(true), data: z.unknown() }).safeParse(await postSessionJson(path, body));
  if (!envelope.success) throw new ApiError(502, "INVALID_RESPONSE");
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) throw new ApiError(502, "INVALID_RESPONSE");
  return parsed.data;
}

export const reportIncident = (values: z.infer<typeof reportIncidentSchema>) =>
  call("rider/incidents", reportIncidentSchema.parse(values), incidentSchema);
export const getMyIncidents = (query: Partial<IncidentQuery> = {}) =>
  call("rider/incidents/list", incidentQuerySchema.parse(query), incidentListSchema);
export const getMyIncident = (id: string) =>
  call("rider/incidents/detail", { id: z.string().uuid().parse(id) }, incidentSchema);
export const getOperatorIncidents = (query: Partial<IncidentQuery> = {}) =>
  call("operator/incidents", incidentQuerySchema.parse(query), incidentListSchema);
export const getOperatorIncident = (id: string) =>
  call("operator/incidents/detail", { id: z.string().uuid().parse(id) }, incidentSchema);
export const reviewIncident = (input: z.infer<typeof reviewIncidentSchema>) =>
  call("operator/incidents/review", reviewIncidentSchema.parse(input), incidentSchema);

export function incidentError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Sign in again.";
    if (error.status === 403 && error.code === "RIDER_PROFILE_INCOMPLETE") return "Complete your Rider profile before reporting an incident.";
    if (error.status === 403 && error.code === "RIDER_PROVIDER_MEMBERSHIP_REQUIRED") return "Your Rider account is not linked to a delivery provider. Contact your Operator to finish setup.";
    if (error.status === 403) return "You do not have permission for this incident action.";
    if (error.status === 404) return "The parcel, assignment or incident was not found. Refresh and try again.";
    if (error.status === 409 && error.code === "INCIDENT_ALREADY_REPORTED") return "This parcel already has a report of that type.";
    if (error.status === 409) return "The incident changed before it could be saved. Data is being refreshed; check before trying again.";
    if (error.status === 400) return "Check the incident type, reason and description, then try again.";
    if (error.status === 413) return "The incident request was too large.";
    if (error.status === 429) return "Too many requests. Wait a moment and try again.";
    if (error.code === "INVALID_RESPONSE") return "The incident response was unexpected. Refresh and try again.";
    if (error.status === 0 || error.status >= 500) return "The incident service is unavailable. Refresh before trying again.";
  }
  return "Could not reach the incident service. Check your connection and refresh before retrying.";
}
