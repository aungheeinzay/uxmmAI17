import { pricingFields, pricingRequired } from "../providers/provider.openapi";
import { OrderStatus } from "../../generated/prisma/enums";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../lib/openapi";
import { assignmentQuerySchema, createAssignmentSchema, parcelScanSchema } from "./assignment.validation";

const uuid = { type: "string", format: "uuid" };
const text = { type: "string" };
const person = { type: "object", required: ["id", "fullName", "phone"], properties: {
  id: uuid, fullName: { ...text, nullable: true }, phone: { ...text, nullable: true },
} };
const order = { type: "object", required: [...pricingRequired, "id", "orderCode", "recipientName", "phoneNumber", "deliveryAddress", "township", "deliveryInstructions", "parcelWeight", "parcelWeightUnit", "codAmount", "currency", "status", "hasIncident"], properties: {
  ...pricingFields,
  id: uuid, orderCode: text, recipientName: text, phoneNumber: text, deliveryAddress: text,
  township: text, deliveryInstructions: { ...text, nullable: true },
  parcelWeight: { ...text, description: "Decimal kilograms" }, parcelWeightUnit: { type: "string", enum: ["kg"] },
  codAmount: { ...text, description: "Exact decimal string" }, currency: text,
  status: { type: "string", enum: Object.values(OrderStatus) },
  hasIncident: { type: "boolean", description: "Derived from persisted Rider incident records; true when the parcel has at least one report." },
} };
const pagination = { type: "object", required: ["page", "pageSize", "total", "totalPages"], properties: {
  page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 },
  total: { type: "integer", minimum: 0 }, totalPages: { type: "integer", minimum: 0 },
} };
export const assignmentSchemas = {
  CreateAssignmentInput: inputSchema(createAssignmentSchema),
  ParcelScanInput: inputSchema(parcelScanSchema),
  // JSON Schema cannot encode Zod refinements; document their exact runtime constraints explicitly.
  DeliveryStatusInput: { type: "object", additionalProperties: false, required: ["status"], properties: {
    status: { type: "string", enum: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"] },
    note: { type: "string", minLength: 1, maxLength: 1000, description: "Trimmed; required with at least 3 characters for FAILED. Optional for other statuses." },
  }, description: "FAILED requires note (3–1000 characters after trimming). Unknown fields, null/blank notes and unsupported statuses return 400." },
  AssignmentPerson: person,
  AssignmentOrder: order,
  RiderAssignment: { type: "object", required: ["id", "orderId", "riderId", "assignedById", "assignedAt", "rider", "assignedBy", "order"], properties: {
    id: uuid, orderId: uuid, riderId: uuid, assignedById: uuid, assignedAt: { type: "string", format: "date-time" },
    rider: ref("AssignmentPerson"), assignedBy: ref("AssignmentPerson"), order: ref("AssignmentOrder"),
  } },
  RiderAssignmentDetail: { allOf: [ref("RiderAssignment"), { type: "object", properties: { order: {
    allOf: [ref("AssignmentOrder"), { type: "object", required: ["statusEvents"], properties: {
      statusEvents: { type: "array", items: { type: "object", required: ["id", "previousStatus", "status", "note", "createdAt", "actor"], properties: {
        id: uuid, previousStatus: { type: "string", enum: Object.values(OrderStatus) }, status: { type: "string", enum: Object.values(OrderStatus) },
        note: { ...text, nullable: true }, createdAt: { type: "string", format: "date-time" },
        actor: { type: "object", required: ["id", "fullName"], properties: { id: uuid, fullName: { ...text, nullable: true } } },
      } } },
    } }],
  } } }] },
  UpdatedRiderAssignment: { allOf: [ref("RiderAssignmentDetail"), { type: "object", required: ["previousStatus"], properties: { previousStatus: { type: "string", enum: Object.values(OrderStatus) } } }] },
  AssignmentList: { type: "object", required: ["assignments", "pagination"], properties: {
    assignments: { type: "array", items: ref("RiderAssignment") }, pagination,
  } },
  RiderAssignmentCounts: { type: "object", required: ["active", "completed"], properties: {
    active: { type: "object", required: ["all", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"], properties: {
      all: { type: "integer", minimum: 0 }, PICKED_UP: { type: "integer", minimum: 0 },
      IN_TRANSIT: { type: "integer", minimum: 0 }, OUT_FOR_DELIVERY: { type: "integer", minimum: 0 },
    } },
    completed: { type: "object", required: ["all", "DELIVERED", "FAILED", "CANCELLED"], properties: {
      all: { type: "integer", minimum: 0 }, DELIVERED: { type: "integer", minimum: 0 },
      FAILED: { type: "integer", minimum: 0 }, CANCELLED: { type: "integer", minimum: 0 },
    } },
  }, description: "Counts across the authenticated Rider's full assignment set. Independent of group, status and pagination." },
  RiderAssignmentList: { type: "object", required: ["assignments", "pagination", "counts"], properties: {
    assignments: { type: "array", items: ref("RiderAssignment") }, pagination, counts: ref("RiderAssignmentCounts"),
  } },
};
const errors = errorResponses([400, 401, 403, 404, 409, 500], {
  403: ["FORBIDDEN", "Insufficient permissions."],
  404: ["ASSIGNMENT_NOT_FOUND", "Assignment not found."],
  409: ["ASSIGNMENT_CONFLICT", "Parcel is already assigned or changed concurrently. Refresh before retrying."],
});
const riderForbidden = {
  description: "FORBIDDEN: the account is not a Rider. RIDER_DEACTIVATED: an Operator operationally deactivated the Rider. RIDER_PROVIDER_MEMBERSHIP_REQUIRED: the Rider has no delivery-provider membership. RIDER_PROFILE_INCOMPLETE: full name, phone, vehicle type or a required plate is missing.",
  content: {
    "application/json": {
      schema: ref("Error"),
      examples: {
        forbidden: { summary: "Wrong role", value: { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } } },
        deactivated: { summary: "Operationally deactivated Rider", value: { success: false, error: { code: "RIDER_DEACTIVATED", message: "This Rider account is inactive. Contact your Operator." } } },
        providerMembershipRequired: { summary: "Provider membership missing", value: { success: false, error: { code: "RIDER_PROVIDER_MEMBERSHIP_REQUIRED", message: "Your Rider account is not linked to a delivery provider. Contact your Operator to finish setup." } } },
        profileIncomplete: { summary: "Profile incomplete", value: { success: false, error: { code: "RIDER_PROFILE_INCOMPLETE", message: "Complete your Rider profile before delivery operations. Missing: phone, vehicleType." } } },
      },
    },
  },
};
function riderErrorResponses(statuses: number[], overrides: Record<number, [string, string]> = {}) {
  return { ...errorResponses(statuses.filter(status => status !== 403), overrides), 403: riderForbidden };
}
const query = Object.entries(inputSchema(assignmentQuerySchema).properties!).map(([name, schema]) => ({ in: "query", name, required: false, schema }));
const riderQuery = [
  ...query,
  { in: "query", name: "group", required: false, schema: { type: "string", enum: ["active", "completed"], description: "active = PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY; completed = DELIVERED, FAILED, CANCELLED. Omit for all assigned statuses." } },
  { in: "query", name: "status", required: false, schema: { type: "string", enum: Object.values(OrderStatus), description: "Optional exact status. When group is supplied the status must belong to that group." } },
];
const idParameter = [{ in: "path", name: "id", required: true, schema: uuid }];
const operator = { tags: ["Operator"], security: bearerSecurity };
const rider = { tags: ["Rider Deliveries"], security: bearerSecurity };
export const assignmentPaths = {
  "/api/operator/assignments": {
    post: { ...operator, operationId: "operatorAssignParcel", summary: "Assign a received parcel (OPERATOR only)",
      description: "SME-owned order must be PICKED_UP and have no existing assignment. Rider must have a verified RIDER account with the same persisted provider membership as the Operator, no operational deactivation, and the order deliveryProviderId must also match. Missing membership returns 409 PROVIDER_MEMBERSHIP_REQUIRED; other-provider parcels or Riders return 404. Eligibility checks and insertion run in a Serializable transaction, backed by unique orderId. assignedById comes from authentication. Assignment does not change order status or create a status event. No reassignment. DELIVERING workload does not impose a capacity restriction.",
      requestBody: requestBody(ref("CreateAssignmentInput"), { orderId: "660e8400-e29b-41d4-a716-446655440000", riderId: "770e8400-e29b-41d4-a716-446655440000" }),
      responses: { ...errors,
        404: response("ORDER_NOT_FOUND or RIDER_NOT_ELIGIBLE (missing, wrong-role, unverified, accountless or operationally deactivated Rider)", ref("Error")),
        409: response("ORDER_NOT_RECEIVED or ASSIGNMENT_CONFLICT (duplicate, foreign-key race or serialization conflict)", ref("Error")),
        201: response("Assignment created; order remains PICKED_UP", successSchema(ref("RiderAssignment"))),
      },
    },
    get: { ...operator, operationId: "operatorAssignments", summary: "List assignments (OPERATOR only)",
      description: "Only assignments whose Rider and order both belong to the authenticated Operator's persisted provider, newest assignedAt then id first. Includes current order status, Rider and assigning Operator identities.", parameters: query,
      responses: { ...errorResponses([400, 401, 403, 409, 500], { 403: ["FORBIDDEN", "Insufficient permissions."], 409: ["PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured."] }), 200: response("Paginated assignments", successSchema(ref("AssignmentList"))) },
    },
  },
  "/api/rider/parcel-scans/verify": { post: { ...rider, operationId: "verifyRiderParcelScan", summary: "Verify an assigned parcel QR (RIDER only)",
    description: "Parses the current SURFERTrack QR identifier or order code, then returns details only when the authenticated, active, complete Rider owns an assignment for the same delivery provider. Scanning never creates an assignment or changes status. QR knowledge alone is not authorization.",
    requestBody: requestBody(ref("ParcelScanInput"), { qrData: "a1b2c3d4e5f678901234567890abcdefa1b2c3d4e5f678901234567890abcdef" }),
    responses: { ...riderErrorResponses([400, 401, 404, 500], { 404: ["ASSIGNMENT_NOT_FOUND", "Assigned parcel not found."] }), 200: response("Authorized assigned parcel", successSchema(ref("RiderAssignmentDetail"))) },
  } },
  "/api/rider/assignments": { get: { ...rider, operationId: "riderAssignments", summary: "List my assignments (RIDER only)",
    description: "RIDER only. Requires a completed profile and provider membership; incomplete Riders receive 403 RIDER_PROFILE_INCOMPLETE, and a missing membership returns 403 RIDER_PROVIDER_MEMBERSHIP_REQUIRED. Filters by authenticated Rider ID at the database boundary. riderId query overrides are rejected. Optional group=active|completed selects the dashboard tab; optional status selects one status and must belong to group when both are supplied. Counts always cover the full authenticated Rider assignment set across both groups and are independent of pagination and filters. Includes recipient contact/address, destination city, parcel weight and exact COD strings for assigned deliveries only. Newest assignedAt then id first.", parameters: riderQuery,
    responses: { ...riderErrorResponses([400, 401, 500]), 200: response("Own paginated assignments with full-dataset counts", successSchema(ref("RiderAssignmentList"))) },
  } },
  "/api/rider/assignments/{id}": { get: { ...rider, operationId: "riderAssignmentDetail", summary: "View my assignment (RIDER only)",
    description: "RIDER only. Requires a completed profile and provider membership; incomplete Riders receive 403 RIDER_PROFILE_INCOMPLETE. Missing and other Riders' assignments both return 404. Includes current order status and oldest-first status history with safe actor identity fields.", parameters: idParameter,
    responses: { ...riderErrorResponses([400, 401, 404, 500], { 404: ["ASSIGNMENT_NOT_FOUND", "Assignment not found."] }), 200: response("Own assignment detail", successSchema(ref("RiderAssignmentDetail"))) },
  } },
  "/api/rider/assignments/{id}/status": { patch: { ...rider, operationId: "riderDeliveryStatus", summary: "Update my delivery status (RIDER only)",
    description: "RIDER only. Requires a completed profile and provider membership; incomplete Riders receive 403 RIDER_PROFILE_INCOMPLETE. Only PICKED_UP → IN_TRANSIT; IN_TRANSIT → OUT_FOR_DELIVERY or FAILED; OUT_FOR_DELIVERY → DELIVERED or FAILED. DELIVERED, FAILED, CANCELLED are terminal. FAILED requires a meaningful note of 3–1000 trimmed characters. Ownership lookup, conditional status update, status-event insertion and response read run atomically in a Serializable transaction. Actor is the authenticated Rider. Invalid transitions and concurrent updates return 409; refresh before retrying. No automatic retry.",
    parameters: idParameter, requestBody: requestBody(ref("DeliveryStatusInput"), { status: "IN_TRANSIT" }),
    responses: { ...riderErrorResponses([400, 401, 404, 500], { 404: ["ASSIGNMENT_NOT_FOUND", "Assignment not found."] }), 409: response("STATUS_TRANSITION_NOT_ALLOWED: invalid transition or concurrent status update", ref("Error")), 200: response("Updated own assignment, full history and previousStatus", successSchema(ref("UpdatedRiderAssignment"))) },
  } },
};
