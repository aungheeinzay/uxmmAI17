import { pricingFields, pricingRequired } from "../providers/provider.openapi";
import { OrderStatus } from "../../generated/prisma/enums";
import { bearerSecurity, errorResponses, inputSchema, ref, response, successSchema } from "../../lib/openapi";
import { operatorOrdersQuerySchema, receiveParcelSchema } from "./operator.validation";

const text = { type: "string" };
const uuid = { type: "string", format: "uuid" };
const date = { type: "string", format: "date-time" };
const status = { type: "string", enum: Object.values(OrderStatus) };
const person = { type: "object", required: ["id", "fullName"], properties: {
  id: uuid, fullName: { type: "string", nullable: true },
} };
export const operatorSchemas = {
  ReceiveParcelInput: inputSchema(receiveParcelSchema),
  ReceivedOperatorOrder: { allOf: [ref("OperatorOrderDetail"), {
    type: "object", required: ["previousStatus"], properties: { previousStatus: { type: "string", enum: ["CREATED"] } },
  }] },
  OperatorOrdersQuery: inputSchema(operatorOrdersQuerySchema),
  OperatorOrder: { type: "object", required: [...pricingRequired, "id", "orderCode", "ownerId", "recipientName", "phoneNumber", "township", "deliveryAddress", "senderName", "parcelWeight", "parcelWeightUnit", "codAmount", "currency", "status", "createdAt", "updatedAt", "owner", "operatorId", "operator", "deliveryInstructions", "hasIncident"], properties: {
    ...pricingFields,
    id: uuid, orderCode: text, ownerId: uuid, recipientName: text, phoneNumber: text,
    township: text, deliveryAddress: text, senderName: text, parcelWeight: { type: "string", description: "Decimal kilograms" },
    parcelWeightUnit: { type: "string", enum: ["kg"] }, codAmount: { type: "string", description: "Decimal COD amount" },
    currency: text, status, createdAt: date, updatedAt: date,
    deliveryInstructions: { type: "string", nullable: true },
    hasIncident: { type: "boolean", description: "Derived from persisted Rider incident records; true when the parcel has at least one report. Never stored as a mutable flag and never changes the order status." },
    owner: { ...person, properties: { ...person.properties, phone: { type: "string", nullable: true } } },
    operatorId: { ...uuid, nullable: true }, operator: { ...person, nullable: true, properties: { ...person.properties, phone: { type: "string", nullable: true } } },
  } },
  OperatorOrderDetail: { allOf: [ref("OperatorOrder"), { type: "object", required: ["statusEvents"], properties: {
    warehouseState: { type: "string", nullable: true, enum: ["UNASSIGNED", "ASSIGNED", "DISPATCHED", "COMPLETED", "EXCEPTION", null], description: "Derived operational group; null for CREATED/CANCELLED. No physical location assertion." },
    receipt: { type: "object", nullable: true, required: ["receivedAt", "receivedBy"], properties: { receivedAt: date, receivedBy: person }, description: "First recorded CREATED-to-PICKED_UP event actor/time. Null if unavailable; never inferred from creation time or the selected Operator. Historical actor role is not inferred." },
    failureNote: { type: "string", nullable: true, description: "Note from the latest FAILED history event, or null if unavailable." },
    assignment: { type: "object", nullable: true, required: ["id", "riderId", "assignedById", "assignedAt", "rider"], properties: {
      id: uuid, riderId: uuid, assignedById: uuid, assignedAt: date, rider: ref("AssignmentPerson"),
    }, description: "Current permanent Rider assignment, or null. Additive detail field; list responses are unchanged." },
    statusEvents: { type: "array", items: { type: "object", required: ["id", "previousStatus", "status", "note", "createdAt", "actor"], properties: {
      id: uuid, previousStatus: status, status, note: { type: "string", nullable: true }, createdAt: date, actor: person,
    } } },
  } }] },
  OperatorOrderList: { type: "object", required: ["orders", "pagination"], properties: {
    orders: { type: "array", items: ref("OperatorOrder") },
    pagination: { type: "object", required: ["page", "pageSize", "total", "totalPages"], properties: {
      page: { type: "integer" }, pageSize: { type: "integer" }, total: { type: "integer" }, totalPages: { type: "integer" },
    } },
  } },
};
const common = { tags: ["Operator"], security: bearerSecurity,
  description: "OPERATOR only. Read-only access to SME-owned orders; no ownership or status changes." };
const errors = errorResponses([400, 401, 403, 404, 500], {
  403: ["FORBIDDEN", "Insufficient permissions."], 404: ["ORDER_NOT_FOUND", "Parcel not found."],
});
const queryProperties = inputSchema(operatorOrdersQuerySchema).properties!;
export const operatorPaths = {
  "/api/operator/orders/{id}/receive": { patch: {
    tags: ["Operator"], security: bearerSecurity, operationId: "operatorReceiveParcel", summary: "Receive a CREATED parcel (OPERATOR only)",
    description: "Changes only CREATED to PICKED_UP, representing Operator-confirmed receipt in the single delivery operation. Restricted to SME-owned orders. Actor comes from the verified server session; timestamp is generated by the database. Send an empty JSON object or an optional note; do not send operatorId, actorId, role, or ownership fields. The response returns the complete updated parcel detail, actual status, previousStatus CREATED, and updated status history. A conditional status/owner update and history insertion run in one transaction. Repeated receiving, other statuses (including terminal states), or concurrent changes return 409; refresh parcel details before retrying. No assignment, delivery completion, cancellation, or other status transition is allowed. Received parcels can be queried with GET /api/operator/orders?status=PICKED_UP.",
    parameters: [{ in: "path", name: "id", required: true, schema: uuid }],
    requestBody: { required: false, content: { "application/json": { schema: ref("ReceiveParcelInput"), example: { note: "Parcel received at the intake desk." } } } },
    responses: {
      200: response("Received parcel with previousStatus CREATED and updated status history", successSchema(ref("ReceivedOperatorOrder"))),
      ...errorResponses([400, 401, 403, 404, 409, 500], {
        403: ["FORBIDDEN", "Only Operators may receive parcels."],
        404: ["ORDER_NOT_FOUND", "Parcel not found."],
        409: ["STATUS_TRANSITION_NOT_ALLOWED", "Only CREATED parcels can be received."],
      }),
      409: response("STATUS_TRANSITION_NOT_ALLOWED: parcel is not CREATED (including repeated receiving or terminal status); STATUS_UPDATE_CONFLICT: status, owner or operational scope changed before the conditional write.", ref("Error")),
    },
  } },
  "/api/operator/orders": { get: { ...common, operationId: "operatorListOrders", summary: "List incoming SME orders",
    // unassigned is based on the assignment relation, never inferred from PICKED_UP alone.
    description: "OPERATOR only. Read-only, paginated access to SME-owned orders across all statuses unless filtered. For Received Parcels use status=PICKED_UP. For assignment-eligible parcels use status=PICKED_UP&unassigned=true. unassigned=true checks absence of the Rider assignment relation; unassigned=false checks its presence. PICKED_UP alone does not prove a parcel is unassigned. Results contain orders and pagination (page, pageSize, total, totalPages). Detail responses include nullable Rider assignment metadata.",
    parameters: Object.entries(queryProperties).map(([name, schema]) => ({ in: "query", name, required: false, schema,
      description: name === "unassigned" ? "String true: no assignment relation; string false: an assignment exists. Combine true with status=PICKED_UP for eligible parcels." : name === "createdDate" ? "UTC calendar date (YYYY-MM-DD)" : name === "search" ? "Order code or recipient name, case insensitive" : name === "status" ? "Exact parcel status. Use PICKED_UP for Received Parcels; this is not an unassigned filter." : name === "township" ? "Exact township, case insensitive" : name })),
    responses: { ...errors, 200: response("Newest first; createdAt then id descending. All statuses unless filtered.", successSchema(ref("OperatorOrderList"))) },
  } },
  "/api/operator/orders/{id}": { get: { ...common, operationId: "operatorOrderDetail", summary: "View a parcel and its status history",
    parameters: [{ in: "path", name: "id", required: true, schema: uuid }],
    responses: { ...errors, 200: response("Parcel with oldest-first status history", successSchema(ref("OperatorOrderDetail"))) },
  } },
};
