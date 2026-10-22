import { pricingFields, pricingRequired, createdPricingFields } from "../providers/provider.openapi";
import { createOrderSchema, listOrdersQuerySchema, updateOrderStatusSchema } from "./order.validation";
import { OrderStatus } from "../../generated/prisma/enums";
import { bearerSecurity, errorResponses, inputSchema, ref, requestBody, response, successSchema } from "../../lib/openapi";

// Every supported parcel status, taken from the generated Prisma enum.
const statusValues = Object.values(OrderStatus);

const createExample = {
  destinationCity: "yangon",
  deliveryProviderId: "770e8400-e29b-41d4-a716-446655440000",
  recipientName: "Aung Aung",
  phoneNumber: "09123456789",
  township: "Kamayut",
  deliveryAddress: "Full delivery address",
  parcelWeight: 1.5,
  codAmount: "25000.00",
  senderName: "Example Shop",
  deliveryInstructions: "Please call before delivery.",
  operatorId: "550e8400-e29b-41d4-a716-446655440000",
};

const createdExample = {
  destinationCity: "yangon",
  deliveryProviderId: createExample.deliveryProviderId,
  deliveryProvider: { id: createExample.deliveryProviderId, name: "Shwe Express" },
  deliveryFee: "3500.00",
  id: "660e8400-e29b-41d4-a716-446655440000",
  orderCode: "POA1B2C3D4E5F678",
  ownerId: "550e8400-e29b-41d4-a716-446655440000",
  operatorId: createExample.operatorId,
  recipientName: createExample.recipientName,
  phoneNumber: createExample.phoneNumber,
  township: createExample.township,
  deliveryAddress: createExample.deliveryAddress,
  parcelWeight: "1.5",
  parcelWeightUnit: "kg",
  codAmount: "25000",
  currency: "MMK",
  senderName: createExample.senderName,
  deliveryInstructions: createExample.deliveryInstructions,
  status: "CREATED",
  createdAt: "2026-10-20T00:00:00.000Z",
  updatedAt: "2026-10-20T00:00:00.000Z",
  qr: {
    identifier: "a1b2c3d4e5f678901234567890abcdefa1b2c3d4e5f678901234567890abcdef",
    imageDataUrl: "data:image/png;base64,<png-base64>",
  },
};

const listedExample = {
  id: createdExample.id,
  orderCode: createdExample.orderCode,
  recipientName: createdExample.recipientName,
  phoneNumber: createdExample.phoneNumber,
  township: createdExample.township,
  deliveryAddress: createdExample.deliveryAddress,
  parcelWeight: createdExample.parcelWeight,
  parcelWeightUnit: "kg",
  codAmount: createdExample.codAmount,
  currency: "MMK",
  senderName: createdExample.senderName,
  status: "CREATED",
  createdAt: createdExample.createdAt,
  operatorId: createExample.operatorId,
  operator: { id: createExample.operatorId, fullName: "Test Operator" },
};

const listExample = {
  orders: [listedExample],
  pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  tabCounts: { all: 1, needsPickup: 1, exceptions: 0 },
};

const orderQrExample = {
  id: createdExample.id,
  orderCode: createdExample.orderCode,
  qr: createdExample.qr,
};

const statusViewExample = {
  id: createdExample.id,
  orderCode: createdExample.orderCode,
  status: "IN_TRANSIT",
  timeline: [
    { status: "CREATED", previousStatus: null, note: null, createdAt: "2026-10-20T00:00:00.000Z" },
    { status: "PICKED_UP", previousStatus: "CREATED", note: "Parcel handed over to the assigned Operator", createdAt: "2026-10-20T02:15:00.000Z" },
    { status: "IN_TRANSIT", previousStatus: "PICKED_UP", note: null, createdAt: "2026-10-20T05:40:00.000Z" },
  ],
};

const dashboardExample = {
  totalParcels: 0,
  statusCounts: Object.fromEntries(statusValues.map((status) => [status, 0])),
  deliveryOverview: {
    thisWeek: { startsAt: "2026-10-19T00:00:00.000Z", endsAt: "2026-10-21T00:00:00.000Z", totalShipments: 0, totalDelivered: 0, successRate: 0 },
    thisMonth: { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-21T00:00:00.000Z", totalShipments: 0, totalDelivered: 0, successRate: 0 },
  },
  monthlyCosts: [
    { month: "2026-10", cost: "0", currency: "MMK", parcels: 0 },
  ],
  recentOrders: [],
};

// The status-update response is the full parcel detail plus the status it moved from.
const updatedOrderDetailSchema = {
  allOf: [
    ref("OrderDetail"),
    {
      type: "object",
      required: ["previousStatus"],
      properties: {
        previousStatus: { type: "string", enum: statusValues, description: "Status the parcel held immediately before this accepted update." },
      },
    },
  ],
};

export const orderSchemas = {
  CreateOrderInput: inputSchema(createOrderSchema),
  ListOrdersQuery: inputSchema(listOrdersQuerySchema),
  UpdateOrderStatusInput: inputSchema(updateOrderStatusSchema),
  ParcelQr: {
    type: "object",
    required: ["identifier", "imageDataUrl"],
    properties: {
      identifier: { type: "string", pattern: "^[a-f0-9]{64}$", description: "Opaque parcel identifier encoded in the QR image." },
      imageDataUrl: { type: "string", pattern: "^data:image/png;base64,", description: "PNG QR image as a data URL." },
    },
  },
  OrderQr: {
    type: "object",
    required: ["id", "orderCode", "qr"],
    properties: {
      id: { type: "string", format: "uuid" },
      orderCode: { type: "string" },
      qr: ref("ParcelQr"),
    },
  },
  TrackingTimelineEntry: {
    type: "object",
    required: ["status", "previousStatus", "note", "createdAt"],
    properties: {
      status: { type: "string", enum: statusValues },
      previousStatus: { type: "string", enum: statusValues, nullable: true },
      note: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  OrderStatusView: {
    type: "object",
    required: ["id", "orderCode", "status", "timeline"],
    properties: {
      id: { type: "string", format: "uuid" },
      orderCode: { type: "string" },
      status: { type: "string", enum: statusValues },
      timeline: {
        type: "array",
        description: "Status history in ascending time order, beginning with the CREATED entry.",
        items: ref("TrackingTimelineEntry"),
      },
    },
  },
  DashboardPeriod: {
    type: "object",
    required: ["startsAt", "endsAt", "totalShipments", "totalDelivered", "successRate"],
    properties: {
      startsAt: { type: "string", format: "date-time" },
      endsAt: { type: "string", format: "date-time" },
      totalShipments: { type: "integer", minimum: 0 },
      totalDelivered: { type: "integer", minimum: 0 },
      successRate: { type: "number", minimum: 0, maximum: 100, description: "Delivered shipments divided by period shipments, as a percentage." },
    },
  },
  DashboardTimelineEntry: {
    type: "object",
    required: ["status", "previousStatus", "note", "createdAt", "actor"],
    properties: {
      status: { type: "string", enum: statusValues },
      previousStatus: { type: "string", enum: statusValues, nullable: true },
      note: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      actor: {
        type: "object",
        nullable: true,
        required: ["id", "fullName", "role"],
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string", nullable: true },
          role: { type: "string", enum: ["SME", "OPERATOR", "RIDER"] },
        },
      },
    },
  },
  DashboardRecentOrder: {
    type: "object",
    required: [...pricingRequired, "id", "orderCode", "recipient", "parcel", "status", "createdAt", "trackingTimeline", "qr", "operator", "deliveryRider"],
    properties: {
      ...pricingFields,
      id: { type: "string", format: "uuid" },
      orderCode: { type: "string" },
      recipient: {
        type: "object",
        required: ["name", "phoneNumber", "township", "deliveryAddress"],
        properties: {
          name: { type: "string" },
          phoneNumber: { type: "string" },
          township: { type: "string" },
          deliveryAddress: { type: "string" },
        },
      },
      parcel: {
        type: "object",
        required: ["weight", "weightUnit", "codAmount", "currency", "deliveryInstructions"],
        properties: {
          weight: { type: "string" },
          weightUnit: { type: "string", enum: ["kg"] },
          codAmount: { type: "string" },
          currency: { type: "string" },
          deliveryInstructions: { type: "string", nullable: true },
        },
      },
      status: { type: "string", enum: statusValues },
      createdAt: { type: "string", format: "date-time" },
      trackingTimeline: { type: "array", items: ref("DashboardTimelineEntry") },
      qr: ref("ParcelQr"),
      operator: {
        type: "object",
        nullable: true,
        required: ["id", "fullName", "phone"],
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
        },
      },
      deliveryRider: { type: "object", nullable: true, description: "Always null until rider assignment is implemented." },
    },
  },
  DashboardMonthlyCost: {
    type: "object",
    required: ["month", "cost", "currency", "parcels"],
    properties: {
      month: { type: "string", pattern: "^\\d{4}-\\d{2}$", description: "Calendar month in UTC." },
      cost: { type: "string", description: "Total server-snapshotted delivery fees for the month in MMK, as a decimal string." },
      currency: { type: "string", enum: ["MMK"] },
      parcels: { type: "integer", minimum: 0 },
    },
  },
  OrderDashboard: {
    type: "object",
    required: ["totalParcels", "statusCounts", "deliveryOverview", "monthlyCosts", "recentOrders"],
    properties: {
      totalParcels: { type: "integer", minimum: 0 },
      statusCounts: {
        type: "object",
        required: statusValues,
        properties: Object.fromEntries(statusValues.map((status) => [status, { type: "integer", minimum: 0 }])),
      },
      deliveryOverview: {
        type: "object",
        required: ["thisWeek", "thisMonth"],
        properties: { thisWeek: ref("DashboardPeriod"), thisMonth: ref("DashboardPeriod") },
      },
      monthlyCosts: { type: "array", items: ref("DashboardMonthlyCost") },
      recentOrders: { type: "array", maxItems: 5, items: ref("DashboardRecentOrder") },
    },
  },
  ListedOrder: {
    type: "object",
    required: [...pricingRequired,
      "id", "orderCode", "recipientName", "phoneNumber", "township", "deliveryAddress",
      "parcelWeight", "parcelWeightUnit", "codAmount", "currency", "senderName", "status",
      "createdAt", "operatorId", "operator",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      orderCode: { type: "string" },
      operatorId: { type: "string", format: "uuid", nullable: true },
      recipientName: { type: "string" },
      phoneNumber: { type: "string" },
      township: { type: "string" },
      deliveryAddress: { type: "string" },
      parcelWeight: { type: "string", description: "Weight in kilograms as a decimal string." },
      parcelWeightUnit: { type: "string", enum: ["kg"] },
      ...pricingFields,
      codAmount: { type: "string", description: "Cash-on-delivery amount in MMK. Not a delivery fee." },
      currency: { type: "string", enum: ["MMK"] },
      senderName: { type: "string" },
      status: { type: "string", enum: statusValues },
      createdAt: { type: "string", format: "date-time" },
      operator: {
        type: "object",
        required: ["id", "fullName"],
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string", nullable: true },
        },
        nullable: true,
      },
    },
  },
  OrderList: {
    type: "object",
    required: ["orders", "pagination", "tabCounts"],
    properties: {
      orders: { type: "array", items: ref("ListedOrder") },
      pagination: {
        type: "object",
        required: ["page", "pageSize", "total", "totalPages"],
        properties: {
          page: { type: "integer", minimum: 1 },
          pageSize: { type: "integer", minimum: 1, maximum: 100 },
          total: { type: "integer", minimum: 0 },
          totalPages: { type: "integer", minimum: 0 },
        },
      },
      tabCounts: {
        type: "object",
        required: ["all", "needsPickup", "exceptions"],
        properties: {
          all: { type: "integer", minimum: 0, description: "Total parcels across every status." },
          needsPickup: { type: "integer", minimum: 0, description: "Parcels awaiting Operator pickup (CREATED)." },
          exceptions: { type: "integer", minimum: 0, description: "Parcels in a failed or cancelled state (FAILED, CANCELLED)." },
        },
      },
    },
  },
  CreatedOrder: {
    type: "object",
    required: [
      ...Object.keys(createdPricingFields),
      "id", "orderCode", "ownerId", "operatorId", "recipientName", "phoneNumber",
      "township", "deliveryAddress", "parcelWeight", "parcelWeightUnit", "codAmount",
      "currency", "senderName", "deliveryInstructions", "status", "createdAt", "updatedAt", "qr",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      orderCode: { type: "string" },
      ownerId: { type: "string", format: "uuid" },
      operatorId: { type: "string", format: "uuid" },
      recipientName: { type: "string" },
      phoneNumber: { type: "string" },
      township: { type: "string" },
      deliveryAddress: { type: "string" },
      parcelWeight: { type: "string", description: "Weight in kilograms as a decimal string." },
      parcelWeightUnit: { type: "string", enum: ["kg"] },
      ...createdPricingFields,
      codAmount: { type: "string", description: "Cash-on-delivery amount in MMK. Not a delivery fee." },
      currency: { type: "string", enum: ["MMK"] },
      senderName: { type: "string" },
      deliveryInstructions: { type: "string", nullable: true },
      status: { type: "string", enum: ["CREATED"] },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      qr: ref("ParcelQr"),
    },
  },
  OrderDetail: {
    type: "object",
    required: [
      ...pricingRequired,
      "id", "orderCode", "ownerId", "operatorId", "recipientName", "phoneNumber",
      "township", "deliveryAddress", "parcelWeight", "parcelWeightUnit", "codAmount",
      "currency", "senderName", "deliveryInstructions", "status", "createdAt", "updatedAt",
      "owner", "operator",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      orderCode: { type: "string" },
      ownerId: { type: "string", format: "uuid" },
      operatorId: { type: "string", format: "uuid", nullable: true },
      recipientName: { type: "string" },
      phoneNumber: { type: "string" },
      township: { type: "string" },
      deliveryAddress: { type: "string" },
      parcelWeight: { type: "string", description: "Weight in kilograms as a decimal string." },
      parcelWeightUnit: { type: "string", enum: ["kg"] },
      ...pricingFields,
      codAmount: { type: "string", description: "Cash-on-delivery amount in MMK. Not a delivery fee." },
      currency: { type: "string", enum: ["MMK"] },
      senderName: { type: "string" },
      deliveryInstructions: { type: "string", nullable: true },
      status: { type: "string", enum: statusValues },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      owner: {
        type: "object",
        required: ["id", "fullName", "phone"],
        description: "The authenticated parcel owner's profile. Contains no account or security data.",
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
        },
      },
      operator: {
        type: "object",
        required: ["id", "fullName", "phone"],
        properties: {
          id: { type: "string", format: "uuid" },
          fullName: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
        },
        nullable: true,
      },
    },
  },
  UpdatedOrderDetail: updatedOrderDetailSchema,
};

const orderDetailExample = {
  ...createdExample,
  owner: { id: createdExample.ownerId, fullName: "Shop Owner", phone: "09123456789" },
  operatorId: createExample.operatorId,
  operator: { id: createExample.operatorId, fullName: "Test Operator", phone: "09123456789" },
};

const statusUpdateExample = {
  status: "CANCELLED",
  note: "Customer requested cancellation",
};

const updatedOrderDetailExample = {
  ...orderDetailExample,
  status: "CANCELLED",
  previousStatus: "CREATED",
  updatedAt: "2026-10-20T01:00:00.000Z",
};

export const orderPaths = {
  "/api/sme/dashboard": {
    get: {
      operationId: "getOrderDashboard", tags: ["SME"], summary: "Get the authenticated SME's dashboard",
      description: "Returns parcel totals and status counts for the authenticated SME, plus current-week and current-month shipment cohorts based on order creation time. Periods use UTC and begin Monday/month-start; successRate is delivered divided by created shipments as a percentage. monthlyCosts reports the last six calendar months in UTC, oldest first: cost is the sum of server-snapshotted deliveryFee values for parcels created in that month and parcels is their count, so months without parcels report zero. COD remains a separate financial value. Includes at most five recent parcels with their status event timeline, QR PNG data URL and assigned Operator. Rider assignment is not represented in the current data model, so deliveryRider is null.",
      security: bearerSecurity,
      responses: {
        200: response("SME order dashboard", successSchema(ref("OrderDashboard")), { success: true, data: dashboardExample }),
        ...errorResponses([401, 403, 500], { 403: ["FORBIDDEN", "Insufficient permissions."] }),
      },
    },
  },
  "/api/orders": {
    get: {
      operationId: "listOrders", tags: ["Orders"], summary: "List the authenticated SME's parcels",
      description: "Returns the caller's own parcels, newest first. Search matches order code or recipient name; status filters by parcel status and tab filters by a saved view. Results are paginated; the pagination envelope reports page, pageSize, total matching records and totalPages. tabCounts reports the totals for every list tab (all, needsPickup, exceptions) regardless of the active tab, search or page. Tab views: all (every status), needs_pickup (CREATED), exceptions (FAILED, CANCELLED). Access is always scoped to the authenticated SME; client-supplied owner/account/SME identifiers are ignored.",
      security: bearerSecurity,
      parameters: [
        { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number. Invalid values are rejected." },
        { name: "pageSize", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Records per page (1-100). Invalid values are rejected." },
        { name: "search", in: "query", required: false, schema: { type: "string", maxLength: 120 }, description: "Trimmed text matched against order code or recipient name." },
        { name: "status", in: "query", required: false, schema: { type: "string", enum: statusValues }, description: "Filter by an exact parcel status. Takes precedence over tab when both are supplied." },
        { name: "tab", in: "query", required: false, schema: { type: "string", enum: ["all", "needs_pickup", "exceptions"], default: "all" }, description: "Saved parcel view. all = every status; needs_pickup = CREATED; exceptions = FAILED, CANCELLED." },
      ],
      responses: {
        200: response("Paginated parcel list", successSchema(ref("OrderList")), { success: true, data: listExample }),
        ...errorResponses([400, 401, 403, 404, 500], {
          403: ["FORBIDDEN", "Insufficient permissions."],
        }),
      },
    },
    post: {
      operationId: "createOrder", tags: ["Orders"], summary: "Create an order",
      description: "Authenticated SME users create an order for their own profile. destinationCity and deliveryProviderId are required; the server resolves an Operator within that provider when operatorId is omitted, or validates the supplied Operator belongs to that provider. Active city pricing is resolved and snapshotted in a Serializable transaction with bounded retries. Client deliveryFee is rejected. COD is stored separately from the server-resolved delivery fee.",
      security: bearerSecurity,
      requestBody: requestBody(ref("CreateOrderInput"), createExample),
      responses: {
        201: response("Created order", successSchema(ref("CreatedOrder")), { success: true, data: createdExample }),
        ...errorResponses([400, 401, 403, 404, 409, 500], {
          403: ["FORBIDDEN", "Insufficient permissions."],
          404: ["OPERATOR_NOT_AVAILABLE", "Operator is not available."],
          409: ["ORDER_CREATE_FAILED", "Unable to create the order. Try again."],
        }),
      },
    },
  },
  "/api/orders/{id}": {
    get: {
      operationId: "getOrder", tags: ["Orders"], summary: "Get parcel details",
      description: "Returns the complete detail of one parcel owned by the authenticated SME. The path identifier is either the parcel's UUID id or its order code (PO followed by 16 uppercase hex characters). Access is enforced inside the database lookup: a parcel belonging to another SME is reported exactly like a missing parcel, so its existence is never revealed. Delivery instructions, COD, timestamps, the owner's profile and assigned Operator are included.",
      security: bearerSecurity,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", maxLength: 64 }, description: "Parcel UUID id or order code (PO + 16 uppercase hex characters, case-insensitive). Anything else is rejected with 400." },
      ],
      responses: {
        200: response("Parcel details", successSchema(ref("OrderDetail")), { success: true, data: orderDetailExample }),
        ...errorResponses([400, 401, 403, 404, 500], {
          403: ["FORBIDDEN", "Insufficient permissions."],
          404: ["ORDER_NOT_FOUND", "Parcel not found."],
        }),
      },
    },
  },
  "/api/orders/{id}/qr": {
    get: {
      operationId: "getOrderQr", tags: ["Orders"], summary: "Get the QR code for an owned parcel",
      description: "Returns the persisted opaque QR identifier and a PNG data URL generated from it. The path identifier is the parcel UUID or order code. Ownership is enforced in the database lookup, and inaccessible parcels are reported like missing parcels. The QR payload contains no recipient or financial information and is not an authorization credential.",
      security: bearerSecurity,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", maxLength: 64 }, description: "Parcel UUID id or order code (PO + 16 uppercase hex characters, case-insensitive). Anything else is rejected with 400." },
      ],
      responses: {
        200: response("Parcel QR code", successSchema(ref("OrderQr")), { success: true, data: orderQrExample }),
        ...errorResponses([400, 401, 403, 404, 500], {
          403: ["FORBIDDEN", "Insufficient permissions."],
          404: ["ORDER_NOT_FOUND", "Parcel not found."],
        }),
      },
    },
  },
  "/api/orders/{id}/status": {
    get: {
      operationId: "getOrderStatus", tags: ["Orders"], summary: "Read a parcel's delivery status",
      description: [
        "Returns the current delivery status and the timestamped status history of one parcel owned by the authenticated SME.",
        "The path identifier is either the parcel's UUID id or its order code (PO followed by 16 hexadecimal characters, case-insensitive). Anything else is rejected with 400.",
        "The response contains only the parcel id, order code, current status and status events; recipient name, phone number, delivery address, COD and coordinates are never included.",
        "Ownership is enforced inside the database lookup, so another SME's parcel is reported exactly like a missing parcel and its existence is never revealed.",
        "Status values are the canonical enum values CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED and CANCELLED; clients map them to their own display labels.",
      ].join(" "),
      security: bearerSecurity,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", maxLength: 64 }, description: "Parcel UUID id or order code (PO + 16 uppercase hex characters, case-insensitive). Anything else is rejected with 400." },
      ],
      responses: {
        200: response("Parcel delivery status", successSchema(ref("OrderStatusView")), { success: true, data: statusViewExample }),
        ...errorResponses([400, 401, 403, 404, 500], {
          403: ["FORBIDDEN", "Insufficient permissions."],
          404: ["ORDER_NOT_FOUND", "Parcel not found."],
        }),
      },
    },
    patch: {
      operationId: "updateOrderStatus", tags: ["Orders"], summary: "Cancel an owned CREATED parcel (SME only)",
      description: [
        "Changes the status of one parcel owned by the authenticated SME and returns the updated parcel with previousStatus set to the status it moved from. The actor is always the authenticated user; ownership, actor ids and timestamps are never accepted from the client.",
        "Transition rules (only these are permitted; self-transitions are rejected):",
        "CREATED -> CANCELLED only;",
        "SME owners cannot set PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED or FAILED; those transitions belong to Operator receipt or assigned Rider delivery APIs.",
        "DELIVERED, FAILED and CANCELLED are terminal: any change from them fails with 409 ORDER_IS_TERMINAL.",
        "Any other combination fails with 409 STATUS_TRANSITION_NOT_ALLOWED.",
        "If another request changes the status first, the update is rejected with 409 STATUS_UPDATE_CONFLICT instead of silently overwriting it.",
        "The status change and its history record (order_status_events: previous status, new status, actor, timestamp, optional note) are written in one transaction.",
      ].join(" "),
      security: bearerSecurity,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", maxLength: 64 }, description: "Parcel UUID id or order code (PO + 16 uppercase hex characters, case-insensitive). Anything else is rejected with 400." },
      ],
      requestBody: requestBody(ref("UpdateOrderStatusInput"), statusUpdateExample, "Only status and an optional note are accepted. Unknown fields are rejected with 400."),
      responses: {
        200: response("Updated parcel", successSchema(updatedOrderDetailSchema), { success: true, data: updatedOrderDetailExample }),
        ...errorResponses([400, 401, 403, 404, 409, 500], {
          403: ["FORBIDDEN", "Insufficient permissions."],
          404: ["ORDER_NOT_FOUND", "Parcel not found."],
          409: ["STATUS_TRANSITION_NOT_ALLOWED", "That status change is not allowed from the parcel's current status."],
        }),
      },
    },
  },
};
