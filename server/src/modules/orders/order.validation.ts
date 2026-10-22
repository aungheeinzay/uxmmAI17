import { z } from "zod";
import { citySchema } from "../providers/provider.validation";
import { OrderStatus } from "../../generated/prisma/enums";

// Local 09 + 7-9 subscriber digits, or international 959/+959 with the leading 0 omitted.
export const myanmarMobilePhone = /^(?:09\d{7,9}|\+?959\d{7,9})$/;

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const parcelWeightSchema = z.union([
  z.number(),
  z.string().trim(),
]).transform((value, context) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (typeof value === "string" && !/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(value)) {
    context.addIssue({ code: "custom", message: "Parcel weight must be a positive number of kilograms." });
    return z.NEVER;
  }
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 1000) {
    context.addIssue({ code: "custom", message: "Parcel weight must be a positive number of kilograms." });
    return z.NEVER;
  }
  return numeric;
});

const codAmountSchema = z.union([
  z.string().trim(),
  z.number(),
]).transform((value, context) => {
  const raw = typeof value === "number" ? value.toString() : value;
  if (!Number.isFinite(typeof value === "number" ? value : Number(raw)) || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(raw)) {
    context.addIssue({ code: "custom", message: "COD must be a non-negative MMK amount with up to 2 decimal places." });
    return z.NEVER;
  }
  return raw;
});

// Shared list pagination defaults and bounds.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Query params arrive as strings; coerce, trim and default them, then reject invalid values.
const pageSchema = z.coerce.number().int().min(1).default(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);
const searchSchema = z.string().trim().min(1).max(120).optional();

// All statuses come from the generated Prisma enum so the API and schema cannot drift.
const listedStatuses = Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]];

// Saved parcel views shown as tabs on the parcel list. Each view maps to a set of statuses.
export const ORDER_TABS = {
  all: [],
  needs_pickup: ["CREATED"],
  exceptions: ["FAILED", "CANCELLED"],
} as const satisfies Record<string, readonly OrderStatus[]>;

export type OrderTab = keyof typeof ORDER_TABS;

export const listOrdersQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  search: searchSchema,
  status: z.enum(listedStatuses).optional(),
  tab: z.enum(Object.keys(ORDER_TABS) as [OrderTab, ...OrderTab[]]).default("all"),
}).strict();

export const createOrderSchema = z.object({
  recipientName: requiredText(120),
  phoneNumber: z.string().trim().min(1).max(32).transform((value, context) => {
    const normalized = value.replace(/[\s-]/g, "");
    if (!myanmarMobilePhone.test(normalized)) {
      context.addIssue({ code: "custom", message: "Phone number must use a supported Myanmar mobile format." });
      return z.NEVER;
    }
    return normalized;
  }),
  township: requiredText(120),
  deliveryAddress: requiredText(500),
  parcelWeight: parcelWeightSchema,
  codAmount: codAmountSchema,
  senderName: requiredText(120),
  deliveryInstructions: z.string().trim().max(1000).optional().nullable(),
  // Existing callers may provide a specific Operator, but the server can resolve a
  // provider-scoped Operator when the SME UI does not have an Operator directory.
  operatorId: z.string().uuid().optional(),
  destinationCity: citySchema,
  deliveryProviderId: z.string().uuid(),
}).strict();

// Public parcel identifier for detail lookups: the UUID id or the generated order code.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const orderCodePattern = /^PO[0-9A-F]{16}$/i;

export const orderIdentifierSchema = z.string().trim().min(1).max(64).transform((value, context) => {
  if (uuidPattern.test(value)) return { kind: "id" as const, value: value.toLowerCase() };
  if (orderCodePattern.test(value)) return { kind: "orderCode" as const, value: value.toUpperCase() };
  context.addIssue({ code: "custom", message: "Parcel identifier must be a valid order id or order code." });
  return z.NEVER;
});

// Status values come from the generated Prisma enum so the API and the schema cannot drift.
const supportedStatuses = Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]];

// The client only proposes a status change. Ownership, actor and timestamps are never accepted.
export const updateOrderStatusSchema = z.object({
  status: z.enum(supportedStatuses),
  note: z.string().trim().max(1000).optional().nullable(),
}).strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type OrderIdentifier = z.infer<typeof orderIdentifierSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
