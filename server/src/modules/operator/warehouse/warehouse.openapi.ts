import { bearerSecurity, errorResponses, inputSchema, ref, response, successSchema } from "../../../lib/openapi";
import { warehouseQuerySchema } from "./warehouse.validation";
import { warehouseStates } from "./warehouse.state";
const count = { type: "integer", minimum: 0 };
export const warehouseSchemas = {
  WarehouseOverview: { type: "object", required: ["scope", "unassigned", "assignedAwaitingDispatch", "receivedAwaitingDispatch", "dispatched", "completed", "exceptions"], properties: {
    scope: { type: "string", enum: ["ALL_TIME"], description: "All SME-owned orders in the single delivery operation, grouped by current status. No date filter; independent of table filters." },
    unassigned: count, assignedAwaitingDispatch: count, receivedAwaitingDispatch: { ...count, description: "unassigned + assignedAwaitingDispatch. Received inventory awaiting dispatch; no shelf/location evidence is recorded." },
    dispatched: { ...count, description: "Current IN_TRANSIT or OUT_FOR_DELIVERY, not warehouse inventory." },
    completed: { ...count, description: "Current DELIVERED, historical tracking total, not warehouse inventory." }, exceptions: { ...count, description: "Current FAILED, tracking group, not proof of physical return." },
  } },
  WarehouseState: { type: "string", enum: [...warehouseStates], description: "UNASSIGNED: PICKED_UP without assignment; ASSIGNED: PICKED_UP with assignment; DISPATCHED: IN_TRANSIT/OUT_FOR_DELIVERY; COMPLETED: DELIVERED; EXCEPTION: FAILED. CREATED/CANCELLED have no warehouse state. Tracking groups do not prove warehouse location." },
  WarehouseParcel: { allOf: [ref("OperatorOrder"), { type: "object", required: ["warehouseState", "assignment"], properties: {
    warehouseState: ref("WarehouseState"), assignment: { type: "object", nullable: true, required: ["id", "riderId", "assignedById", "assignedAt", "rider"], properties: {
      id: { type: "string", format: "uuid" }, riderId: { type: "string", format: "uuid" }, assignedById: { type: "string", format: "uuid" },
      assignedAt: { type: "string", format: "date-time" }, rider: ref("AssignmentPerson"),
    } },
  } }] },
  WarehouseParcelList: { type: "object", required: ["orders", "pagination"], properties: {
    orders: { type: "array", items: ref("WarehouseParcel") }, pagination: { type: "object", required: ["page", "pageSize", "total", "totalPages"], properties: { page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", minimum: 1, maximum: 100 }, total: count, totalPages: count } },
  } },
};
const common = { tags: ["Operator Warehouse"], security: bearerSecurity };
const errors = errorResponses([400, 401, 403, 500], { 403: ["FORBIDDEN", "Only Operators may inspect warehouse operations."] });
export const warehousePaths = {
  "/api/operator/warehouse/overview": { get: { ...common, operationId: "operatorWarehouseOverview", summary: "Warehouse inventory and tracking overview (OPERATOR only)",
    description: "Five database counts use one RepeatableRead snapshot, scoped to SME-owned orders in the current single delivery operation. All-time current-status scope, independent of parcel-list filters. Received awaiting dispatch = UNASSIGNED + ASSIGNED only. Dispatched, completed and exception totals are operational tracking groups, not physical warehouse inventory. CREATED/CANCELLED are excluded. No query parameters are accepted.",
    responses: { ...errors, 200: response("Database-derived overview; example illustrates an empty operation", successSchema(ref("WarehouseOverview")), { success: true, data: { scope: "ALL_TIME", unassigned: 0, assignedAwaitingDispatch: 0, receivedAwaitingDispatch: 0, dispatched: 0, completed: 0, exceptions: 0 } }) },
  } },
  "/api/operator/warehouse/parcels": { get: { ...common, operationId: "operatorWarehouseParcels", summary: "Filter warehouse inventory and delivery tracking (OPERATOR only)",
    description: "Returns orders and pagination, newest createdAt then id first. Default includes PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED; CREATED and CANCELLED never appear. State classification uses current status plus the real assignment relation. Filtering/count/pagination happen in PostgreSQL in a consistent RepeatableRead snapshot. Includes safe Rider assignment metadata without N+1 parcel lookups. No client role, ownerId, operatorId or status override accepted. Reuse GET /api/operator/orders/{id} for details/history, receipt actor/time and failure note.",
    parameters: Object.entries(inputSchema(warehouseQuerySchema).properties!).map(([name, schema]) => ({ in: "query", name, required: false, schema,
      description: name === "search" ? "Case-insensitive order code or recipient name substring" : name === "township" ? "Exact township, case insensitive" : name === "createdDate" ? "UTC order creation date YYYY-MM-DD, not receipt/dispatch date" : name === "warehouseState" ? "Derived operational group; omit for all five groups" : name })),
    responses: { ...errors, 200: response("Paginated warehouse parcels; zero matching rows have totalPages 0", successSchema(ref("WarehouseParcelList")), { success: true, data: { orders: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } } }) },
  } },
};
