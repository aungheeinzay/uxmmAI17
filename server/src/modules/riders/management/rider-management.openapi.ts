import { OrderStatus } from "../../../generated/prisma/enums";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../../lib/openapi";
import { operatorRiderUpdateSchema, riderManagementQuerySchema, riderDetailQuerySchema } from "./rider-management.validation";
const uuid = { type: "string", format: "uuid" }, text = { type: "string" }, count = { type: "integer", minimum: 0 }, date = { type: "string", format: "date-time" };
const pagination = { type: "object", required: ["page", "pageSize", "total", "totalPages"], properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, total: count, totalPages: count } };
const status = { type: "string", enum: Object.values(OrderStatus) };
const vehicle = { type: "object", required: ["type", "plateNumber", "model", "color"], properties: {
  type: { type: "string", enum: ["MOTORCYCLE", "BICYCLE", "CAR", "VAN", "ON_FOOT"], nullable: true },
  plateNumber: { ...text, nullable: true }, model: { ...text, nullable: true }, color: { ...text, nullable: true },
} };
export const riderManagementSchemas = {
  ManagedRider: { type: "object", required: ["id", "fullName", "phone", "email", "providerId", "provider", "accountStatus", "isActive", "deactivatedAt", "vehicle", "profileComplete", "missingFields", "completedAt", "workload", "assignedTaskCount", "inProgressDeliveryCount", "activeAssignedTaskCount", "completedDeliveryCount"], properties: {
    id: uuid, fullName: { ...text, nullable: true }, phone: { ...text, nullable: true }, email: { ...text, format: "email", nullable: true }, providerId: uuid,
    provider: { type: "object", required: ["id", "name"], properties: { id: uuid, name: text } },
    accountStatus: { type: "string", enum: ["ACTIVATED", "UNVERIFIED", "NO_ACCOUNT"], description: "Account/email activation only. This is separate from operational isActive." },
    isActive: { type: "boolean", description: "Operational eligibility. False after Operator deactivation." },
    deactivatedAt: { ...date, nullable: true },
    vehicle,
    profileComplete: { type: "boolean", description: "Derived from persisted identity, vehicle and provider membership." },
    missingFields: { type: "array", items: text },
    completedAt: { ...date, nullable: true, description: "Null when the profile no longer satisfies completion rules." },
    workload: { type: "string", enum: ["AVAILABLE", "HAS_ASSIGNED_TASKS", "DELIVERING"], description: "Task workload only; never online presence, shift status or physical availability. DELIVERING takes precedence." },
    assignedTaskCount: { ...count, description: "PICKED_UP assignments for this provider." }, inProgressDeliveryCount: { ...count, description: "IN_TRANSIT or OUT_FOR_DELIVERY assignments for this provider." },
    activeAssignedTaskCount: { ...count, description: "Assigned plus in-progress tasks." }, completedDeliveryCount: { ...count, description: "All-time DELIVERED assignments whose orders belong to this provider; FAILED/CANCELLED excluded." },
  } },
  ManagedRiderList: { type: "object", required: ["riders", "pagination"], properties: { riders: { type: "array", items: ref("ManagedRider") }, pagination } },
  RiderMutationResult: { type: "object", required: ["rider"], properties: { rider: ref("ManagedRider") } },
  RiderWorkloadOverview: { type: "object", required: ["totalRiders", "available", "assigned", "delivering", "inactive"], properties: { totalRiders: count, available: { ...count, description: "Active Riders with no active tasks." }, assigned: { ...count, description: "Active Riders with PICKED_UP but no in-progress delivery." }, delivering: { ...count, description: "Active Riders with IN_TRANSIT or OUT_FOR_DELIVERY work." }, inactive: { ...count, description: "Operationally deactivated Riders." } } },
  ProviderPendingInvitations: { type: "object", required: ["invitations", "pagination"], properties: { pagination, invitations: { type: "array", items: { type: "object", required: ["id", "email", "fullName", "createdAt", "expiresAt"], properties: { id: uuid, email: { ...text, format: "email" }, fullName: { ...text, nullable: true }, createdAt: date, expiresAt: date } } } } },
  ManagedRiderDetail: { type: "object", required: ["rider", "assignments", "pagination"], properties: { rider: ref("ManagedRider"), pagination, assignments: { type: "array", items: { type: "object", required: ["id", "orderId", "assignedAt", "order"], properties: {
    id: uuid, orderId: uuid, assignedAt: date, order: { type: "object", required: ["id", "orderCode", "recipientName", "township", "destinationCity", "status", "statusEvents"], properties: {
      id: uuid, orderCode: text, recipientName: text, township: text, destinationCity: { ...text, nullable: true }, status,
      statusEvents: { type: "array", maxItems: 20, items: { type: "object", required: ["id", "previousStatus", "status", "note", "createdAt"], properties: { id: uuid, previousStatus: status, status, note: { ...text, nullable: true }, createdAt: date } } },
    } },
  } } } } },
};
const errors = errorResponses([400, 401, 403, 409, 500], { 403: ["FORBIDDEN", "Only Operators may manage Riders."], 409: ["PROVIDER_MEMBERSHIP_REQUIRED", "Your delivery provider has not been configured."] });
const common = { tags: ["Operator"], security: bearerSecurity };
const params = (schema: ReturnType<typeof inputSchema>) => Object.entries(schema.properties!).map(([name, value]) => ({ in: "query", name, required: false, schema: value }));
export const riderManagementPaths = {
  "/api/operator/riders": { get: { ...common, operationId: "operatorManagedRiders", summary: "List my provider's Riders and workload",
    description: "Uses the Operator's persisted providerId, never request-supplied scope. Includes Rider profiles with activated, unverified or missing accounts; pending invitees are separate. eligible=true restricts to verified, operationally active linked accounts for assignment selection. status=ACTIVE|INACTIVE filters operational deactivation; workload filters only active Riders. Filters/search apply in the database before pagination. AVAILABLE means zero active tasks; HAS_ASSIGNED_TASKS means PICKED_UP but no delivery in progress; DELIVERING means IN_TRANSIT or OUT_FOR_DELIVERY and takes precedence. DELIVERED/FAILED/CANCELLED are not active. Counts include only orders of this provider. No capacity limit or presence tracking. Stable fullName/id ordering.",
    parameters: params(inputSchema(riderManagementQuerySchema)), responses: { ...errors, 200: response("Provider-scoped Riders", successSchema(ref("ManagedRiderList"))) },
  } },
  "/api/operator/riders/overview": { get: { ...common, operationId: "operatorRiderWorkloadOverview", summary: "Count provider Riders by workload",
    description: "Unfiltered provider totals in one consistent database snapshot. Pending invitations do not count as Riders. AVAILABLE/assigned/delivering count only operationally active Riders and form disjoint workload groups; inactive is a separate deactivation count. Unverified/accountless Rider profiles are included in totalRiders and labeled separately in the list.",
    responses: { ...errors, 200: response("Rider overview", successSchema(ref("RiderWorkloadOverview"))) },
  } },
  "/api/operator/riders/invitations": { get: { ...common, operationId: "operatorPendingRiderInvitations", summary: "List my provider's pending Rider invitations",
    description: "Unaccepted, unrevoked, unexpired invitations captured for this provider only. Legacy invitations without a captured provider are excluded from this list. No token hashes, passwords or sessions are returned.",
    parameters: params(inputSchema(riderDetailQuerySchema)), responses: { ...errors, 200: response("Pending invitations", successSchema(ref("ProviderPendingInvitations"))) },
  } },
  "/api/operator/riders/{riderId}": {
    get: { ...common, operationId: "operatorManagedRiderDetail", summary: "View a Rider in my provider",
      description: "Other-provider and unconfigured Riders return 404. Includes current workload, operational state, vehicle and completion state plus paginated assignments across all statuses whose orders belong to this provider. Assignments newest first; each parcel has its latest 20 history events, newest first. No credentials or invitation tokens. Manual refresh reflects activation, assignments and status changes; not real-time tracking.",
      parameters: [{ in: "path", name: "riderId", required: true, schema: uuid }, ...params(inputSchema(riderDetailQuerySchema))],
      responses: { ...errors, ...errorResponses([404], { 404: ["RIDER_NOT_FOUND", "Rider not found."] }), 200: response("Provider-scoped Rider detail", successSchema(ref("ManagedRiderDetail"))) },
    },
    patch: { ...common, operationId: "operatorUpdateRider", summary: "Update permitted Rider profile fields",
      description: "Only fullName, phone, vehicle type, plate, model and colour are accepted. Role, provider, account identity, credentials, verification and history are never writable. The request is strict: protected or unknown fields return 400. Reuses Rider profile validation, requires a plate for MOTORCYCLE/CAR/VAN, and recalculates profile completion. Other-provider Riders return 404.",
      parameters: [{ in: "path", name: "riderId", required: true, schema: uuid }],
      requestBody: requestBody(inputSchema(operatorRiderUpdateSchema), { fullName: "Fictional Rider", phone: "09123456789", vehicleType: "MOTORCYCLE", vehiclePlateNumber: "ABC-123", vehicleModel: "Fictional 125", vehicleColor: "Black" }),
      responses: { ...errors, ...errorResponses([404], { 404: ["RIDER_NOT_FOUND", "Rider not found."] }), 200: response("Updated Rider", successSchema(ref("RiderMutationResult"))) },
    },
  },
  "/api/operator/riders/{riderId}/deactivate": { patch: { ...common, operationId: "operatorDeactivateRider", summary: "Deactivate a Rider in my provider",
    description: "Persists an operational inactive state without deleting the account, profile, assignments, orders or incidents. Sessions are revoked and login/refresh plus delivery operations are rejected until reactivated. Idempotent. Blocked with RIDER_HAS_ACTIVE_ASSIGNMENTS when PICKED_UP, IN_TRANSIT or OUT_FOR_DELIVERY work exists; assignments and OrderStatus are never changed automatically. Concurrent state changes return RIDER_DEACTIVATION_CONFLICT. Other-provider Riders return 404. No request body.",
    parameters: [{ in: "path", name: "riderId", required: true, schema: uuid }],
    responses: { ...errors, ...errorResponses([404], { 404: ["RIDER_NOT_FOUND", "Rider not found."] }),
      409: { description: "RIDER_HAS_ACTIVE_ASSIGNMENTS: resolve active work first. RIDER_DEACTIVATION_CONFLICT: the Rider state changed concurrently. PROVIDER_MEMBERSHIP_REQUIRED: configure the Operator provider first.", content: { "application/json": { schema: ref("Error"), examples: {
        activeAssignments: { summary: "Active assignments block deactivation", value: { success: false, error: { code: "RIDER_HAS_ACTIVE_ASSIGNMENTS", message: "This Rider has 1 active assignment. Resolve or safely reassign it before deactivating." } } },
        concurrentChange: { summary: "Concurrent state change", value: { success: false, error: { code: "RIDER_DEACTIVATION_CONFLICT", message: "The Rider state changed concurrently. Refresh and retry." } } },
        providerMembershipRequired: { summary: "Operator provider not configured", value: { success: false, error: { code: "PROVIDER_MEMBERSHIP_REQUIRED", message: "Your delivery provider has not been configured." } } },
      } } } },
      200: response("Deactivated Rider", successSchema(ref("RiderMutationResult"))) },
  } },
  "/api/operator/riders/{riderId}/reactivate": { patch: { ...common, operationId: "operatorReactivateRider", summary: "Reactivate a Rider in my provider",
    description: "Clears the operational inactive state, preserving account identity, provider membership and all history. Idempotent. Creates no assignment and does not mark an incomplete profile complete; delivery operations still require profile completion. Concurrent state changes return RIDER_REACTIVATION_CONFLICT.",
    parameters: [{ in: "path", name: "riderId", required: true, schema: uuid }],
    responses: { ...errors, ...errorResponses([404], { 404: ["RIDER_NOT_FOUND", "Rider not found."] }),
      409: { description: "RIDER_REACTIVATION_CONFLICT: the Rider state changed concurrently. PROVIDER_MEMBERSHIP_REQUIRED: configure the Operator provider first.", content: { "application/json": { schema: ref("Error"), examples: {
        concurrentChange: { summary: "Concurrent state change", value: { success: false, error: { code: "RIDER_REACTIVATION_CONFLICT", message: "The Rider state changed concurrently. Refresh and retry." } } },
        providerMembershipRequired: { summary: "Operator provider not configured", value: { success: false, error: { code: "PROVIDER_MEMBERSHIP_REQUIRED", message: "Your delivery provider has not been configured." } } },
      } } } },
      200: response("Reactivated Rider", successSchema(ref("RiderMutationResult"))) },
  } },
};
