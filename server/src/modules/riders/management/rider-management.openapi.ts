import { OrderStatus } from "../../../generated/prisma/enums";
import { bearerSecurity, errorResponses, inputSchema, ref, response, successSchema } from "../../../lib/openapi";
import { riderManagementQuerySchema, riderDetailQuerySchema } from "./rider-management.validation";
const uuid = { type: "string", format: "uuid" }, text = { type: "string" }, count = { type: "integer", minimum: 0 }, date = { type: "string", format: "date-time" };
const pagination = { type: "object", required: ["page", "pageSize", "total", "totalPages"], properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, total: count, totalPages: count } };
const status = { type: "string", enum: Object.values(OrderStatus) };
export const riderManagementSchemas = {
  ManagedRider: { type: "object", required: ["id", "fullName", "phone", "email", "providerId", "provider", "accountStatus", "workload", "assignedTaskCount", "inProgressDeliveryCount", "activeAssignedTaskCount", "completedDeliveryCount"], properties: {
    id: uuid, fullName: { ...text, nullable: true }, phone: { ...text, nullable: true }, email: { ...text, format: "email", nullable: true }, providerId: uuid,
    provider: { type: "object", required: ["id", "name"], properties: { id: uuid, name: text } },
    accountStatus: { type: "string", enum: ["ACTIVATED", "UNVERIFIED", "NO_ACCOUNT"] },
    workload: { type: "string", enum: ["AVAILABLE", "HAS_ASSIGNED_TASKS", "DELIVERING"], description: "Task workload only; never online presence, shift status or physical availability. DELIVERING takes precedence." },
    assignedTaskCount: { ...count, description: "PICKED_UP assignments for this provider." }, inProgressDeliveryCount: { ...count, description: "IN_TRANSIT or OUT_FOR_DELIVERY assignments for this provider." },
    activeAssignedTaskCount: { ...count, description: "Assigned plus in-progress tasks." }, completedDeliveryCount: { ...count, description: "All-time DELIVERED assignments whose orders belong to this provider; FAILED/CANCELLED excluded." },
  } },
  ManagedRiderList: { type: "object", required: ["riders", "pagination"], properties: { riders: { type: "array", items: ref("ManagedRider") }, pagination } },
  RiderWorkloadOverview: { type: "object", required: ["totalRiders", "available", "assigned", "delivering"], properties: { totalRiders: count, available: count, assigned: count, delivering: count } },
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
    description: "Uses the Operator's persisted providerId, never request-supplied scope. Includes Rider profiles with activated, unverified or missing accounts; pending invitees are separate. eligible=true restricts to verified linked accounts for assignment selection. Filters/search apply in the database before pagination. AVAILABLE means zero active tasks; HAS_ASSIGNED_TASKS means PICKED_UP but no delivery in progress; DELIVERING means IN_TRANSIT or OUT_FOR_DELIVERY and takes precedence. DELIVERED/FAILED/CANCELLED are not active. Counts include only orders of this provider. No capacity limit or presence tracking. Stable fullName/id ordering.",
    parameters: params(inputSchema(riderManagementQuerySchema)), responses: { ...errors, 200: response("Provider-scoped Riders", successSchema(ref("ManagedRiderList"))) },
  } },
  "/api/operator/riders/overview": { get: { ...common, operationId: "operatorRiderWorkloadOverview", summary: "Count provider Riders by workload",
    description: "Unfiltered provider totals in one consistent database snapshot. Pending invitations do not count as Riders. AVAILABLE/assigned/delivering form disjoint workload groups; unverified/accountless Rider profiles are included in totals and labeled separately in the list.",
    responses: { ...errors, 200: response("Rider overview", successSchema(ref("RiderWorkloadOverview"))) },
  } },
  "/api/operator/riders/invitations": { get: { ...common, operationId: "operatorPendingRiderInvitations", summary: "List my provider's pending Rider invitations",
    description: "Unaccepted, unrevoked, unexpired invitations captured for this provider only. Legacy invitations without a captured provider are excluded from this list. No token hashes, passwords or sessions are returned.",
    parameters: params(inputSchema(riderDetailQuerySchema)), responses: { ...errors, 200: response("Pending invitations", successSchema(ref("ProviderPendingInvitations"))) },
  } },
  "/api/operator/riders/{riderId}": { get: { ...common, operationId: "operatorManagedRiderDetail", summary: "View a Rider in my provider",
    description: "Other-provider and unconfigured Riders return 404. Includes current workload plus paginated assignments across all statuses whose orders belong to this provider. Assignments newest first; each parcel has its latest 20 history events, newest first. No credentials or invitation tokens. Manual refresh reflects activation, assignments and status changes; not real-time tracking.",
    parameters: [{ in: "path", name: "riderId", required: true, schema: uuid }, ...params(inputSchema(riderDetailQuerySchema))], responses: { ...errors, ...errorResponses([404], { 404: ["RIDER_NOT_FOUND", "Rider not found."] }), 200: response("Provider-scoped Rider detail", successSchema(ref("ManagedRiderDetail"))) },
  } },
};
