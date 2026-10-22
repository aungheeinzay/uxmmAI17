import { IncidentStatus, IncidentType } from "../../generated/prisma/enums";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../lib/openapi";
import { createIncidentSchema, incidentQuerySchema } from "./incident.validation";

const uuid = { type: "string", format: "uuid" };
const text = { type: "string" };
const person = { type: "object", required: ["id", "fullName", "phone"], properties: {
  id: uuid, fullName: { ...text, nullable: true }, phone: { ...text, nullable: true },
} };
const incidentOrder = { type: "object", required: ["id", "orderCode", "recipientName", "township", "deliveryAddress", "status", "deliveryProviderId"], properties: {
  id: uuid, orderCode: text, recipientName: text, township: text, deliveryAddress: text,
  status: { type: "string" }, deliveryProviderId: { ...uuid, nullable: true },
} };
const incident = { type: "object", required: ["id", "orderId", "riderId", "assignmentId", "providerId", "type", "reason", "description", "status", "reviewedAt", "reviewedById", "createdAt", "updatedAt", "rider", "reviewedBy", "order"], properties: {
  id: uuid, orderId: uuid, riderId: uuid, assignmentId: { ...uuid, nullable: true }, providerId: uuid,
  type: { type: "string", enum: Object.values(IncidentType) },
  reason: { type: "string", maxLength: 200 }, description: { type: "string", maxLength: 1000 },
  status: { type: "string", enum: Object.values(IncidentStatus) },
  reviewedAt: { type: "string", format: "date-time", nullable: true },
  reviewedById: { ...uuid, nullable: true },
  createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
  rider: ref("IncidentPerson"), reviewedBy: { ...ref("IncidentPerson"), nullable: true }, order: ref("IncidentOrder"),
} };
const pagination = { type: "object", required: ["page", "pageSize", "total", "totalPages"], properties: {
  page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 },
  total: { type: "integer", minimum: 0 }, totalPages: { type: "integer", minimum: 0 },
} };

export const incidentSchemas = {
  CreateIncidentInput: inputSchema(createIncidentSchema),
  IncidentReviewInput: { type: "object", additionalProperties: false, required: ["status"], properties: {
    status: { type: "string", enum: [IncidentStatus.REVIEWED], description: "Only REVIEWED is accepted; other values return 400." },
  } },
  IncidentPerson: person,
  IncidentOrder: incidentOrder,
  Incident: incident,
  IncidentList: { type: "object", required: ["incidents", "pagination"], properties: {
    incidents: { type: "array", items: ref("Incident") }, pagination,
  } },
};

const query = Object.entries(inputSchema(incidentQuerySchema).properties!).map(([name, schema]) => ({ in: "query", name, required: false, schema }));
const idParameter = [{ in: "path", name: "id", required: true, schema: uuid }];
const rider = { tags: ["Rider Incidents"], security: bearerSecurity };
const operator = { tags: ["Operator Incidents"], security: bearerSecurity };
const riderForbidden = {
  description: "FORBIDDEN: not a Rider. RIDER_PROVIDER_MEMBERSHIP_REQUIRED: no delivery-provider membership. RIDER_PROFILE_INCOMPLETE: full name, phone, vehicle type or a required plate is missing.",
  content: { "application/json": { schema: ref("Error") } },
};
const riderIncidentErrors = (statuses: number[], overrides: Record<number, [string, string]> = {}) => ({
  ...errorResponses(statuses.filter(status => status !== 403), overrides), 403: riderForbidden,
});

export const incidentPaths = {
  "/api/rider/incidents": {
    post: { ...rider, operationId: "reportRiderIncident", summary: "Report a parcel incident (RIDER only)",
      description: "RIDER only, and only for an assignment owned by the authenticated Rider. Requires a completed profile and provider membership. The order, Rider and provider come from trusted server data; orderId/riderId/providerId overrides are rejected. type is DAMAGED, BROKEN or LOST; reason is 3-200 trimmed characters and description is 1-1000 trimmed characters. One report of a given type per parcel is allowed; duplicates return 409 INCIDENT_ALREADY_REPORTED. Reporting never changes OrderStatus or creates a status event. Photo evidence is not implemented because no approved upload/storage mechanism exists yet.",
      requestBody: requestBody(ref("CreateIncidentInput"), { assignmentId: "880e8400-e29b-41d4-a716-446655440000", type: "DAMAGED", reason: "Parcel arrived crushed", description: "Outer carton torn on one corner, contents appear intact." }),
      responses: { ...riderIncidentErrors([400, 401, 404, 409, 500], {
          404: ["ASSIGNMENT_NOT_FOUND", "Assignment not found."],
          409: ["INCIDENT_ALREADY_REPORTED", "This parcel already has a report of that type."],
        }), 201: response("Incident recorded; the order status is unchanged", successSchema(ref("Incident"))) },
    },
    get: { ...rider, operationId: "listRiderIncidents", summary: "List my incidents (RIDER only)",
      description: "RIDER only. Returns incidents reported by the authenticated Rider, newest first. Requires a completed profile and provider membership.",
      parameters: query,
      responses: { ...riderIncidentErrors([400, 401, 500]), 200: response("Own reported incidents", successSchema(ref("IncidentList"))) },
    },
  },
  "/api/rider/incidents/{id}": { get: { ...rider, operationId: "getRiderIncident", summary: "View my incident (RIDER only)",
    description: "RIDER only. Missing and other Riders' incidents both return 404.",
    parameters: idParameter,
    responses: { ...riderIncidentErrors([400, 401, 404, 500], { 404: ["INCIDENT_NOT_FOUND", "Incident not found."] }), 200: response("Own incident detail", successSchema(ref("Incident"))) },
  } },
  "/api/operator/incidents": { get: { ...operator, operationId: "operatorIncidents", summary: "List provider incidents (OPERATOR only)",
    description: "OPERATOR only. Only incidents whose provider matches the authenticated Operator's persisted provider membership, optionally filtered by status, newest first. Operators with no membership receive 409 PROVIDER_MEMBERSHIP_REQUIRED.",
    parameters: query,
    responses: { ...errorResponses([400, 401, 403, 409, 500], { 403: ["FORBIDDEN", "Insufficient permissions."], 409: ["PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured."] }), 200: response("Provider incidents", successSchema(ref("IncidentList"))) },
  } },
  "/api/operator/incidents/{id}": { get: { ...operator, operationId: "operatorIncidentDetail", summary: "View a provider incident (OPERATOR only)",
    description: "OPERATOR only. Incidents belonging to another provider and missing incidents both return 404.",
    parameters: idParameter,
    responses: { ...errorResponses([400, 401, 403, 404, 409, 500], { 403: ["FORBIDDEN", "Insufficient permissions."], 404: ["INCIDENT_NOT_FOUND", "Incident not found."], 409: ["PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured."] }), 200: response("Incident detail", successSchema(ref("Incident"))) },
  } },
  "/api/operator/incidents/{id}/review": { patch: { ...operator, operationId: "reviewOperatorIncident", summary: "Mark a provider incident reviewed (OPERATOR only)",
    description: "OPERATOR only. Sets status to REVIEWED with a server timestamp and the authenticated Operator as reviewer. Only incidents for the Operator's provider can be reviewed; another provider's incident returns 404. Reviewing an already-reviewed incident is an idempotent no-op.",
    parameters: idParameter, requestBody: requestBody(ref("IncidentReviewInput"), { status: "REVIEWED" }),
    responses: { ...errorResponses([400, 401, 403, 404, 409, 500], { 403: ["FORBIDDEN", "Insufficient permissions."], 404: ["INCIDENT_NOT_FOUND", "Incident not found."], 409: ["PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured."] }), 200: response("Incident reviewed", successSchema(ref("Incident"))) },
  } },
};
