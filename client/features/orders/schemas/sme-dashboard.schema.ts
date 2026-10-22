import { z } from "zod";

export const orderStatusSchema = z.enum([
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
]);

const profileActorSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().nullable(),
  role: z.enum(["SME", "OPERATOR", "RIDER"]),
});

const dashboardPeriodSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  totalShipments: z.number().int().nonnegative(),
  totalDelivered: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(100),
});

const dashboardMonthlyCostSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  cost: z.string(),
  currency: z.string(),
  parcels: z.number().int().nonnegative(),
});

const dashboardOrderSchema = z.object({
  destinationCity: z.string().nullable(),
  deliveryProviderId: z.string().uuid().nullable(),
  deliveryProvider: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  deliveryFee: z.string().nullable(),
  id: z.string().uuid(),
  orderCode: z.string(),
  recipient: z.object({
    name: z.string(),
    phoneNumber: z.string(),
    township: z.string(),
    deliveryAddress: z.string(),
  }),
  parcel: z.object({
    weight: z.string(),
    weightUnit: z.literal("kg"),
    codAmount: z.string(),
    currency: z.string(),
    deliveryInstructions: z.string().nullable(),
  }),
  status: orderStatusSchema,
  createdAt: z.string().datetime(),
  trackingTimeline: z.array(z.object({
    status: orderStatusSchema,
    previousStatus: orderStatusSchema.nullable(),
    note: z.string().nullable(),
    createdAt: z.string().datetime(),
    actor: profileActorSchema.nullable(),
  })),
  qr: z.object({
    identifier: z.string().regex(/^[a-f0-9]{64}$/),
    imageDataUrl: z.string().startsWith("data:image/png;base64,"),
  }),
  operator: z.object({
    id: z.string().uuid(),
    fullName: z.string().nullable(),
    phone: z.string().nullable(),
  }).nullable(),
  deliveryRider: z.null(),
});

export const smeDashboardResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    totalParcels: z.number().int().nonnegative(),
    statusCounts: z.object({
      CREATED: z.number().int().nonnegative(),
      PICKED_UP: z.number().int().nonnegative(),
      IN_TRANSIT: z.number().int().nonnegative(),
      OUT_FOR_DELIVERY: z.number().int().nonnegative(),
      DELIVERED: z.number().int().nonnegative(),
      FAILED: z.number().int().nonnegative(),
      CANCELLED: z.number().int().nonnegative(),
    }).strict(),
    deliveryOverview: z.object({
      thisWeek: dashboardPeriodSchema,
      thisMonth: dashboardPeriodSchema,
    }),
    monthlyCosts: z.array(dashboardMonthlyCostSchema),
    recentOrders: z.array(dashboardOrderSchema).max(5),
  }),
});

export type SmeDashboard = z.infer<typeof smeDashboardResponseSchema>["data"];
export type DashboardOrderStatus = z.infer<typeof orderStatusSchema>;
export type DashboardStatusCounts = SmeDashboard["statusCounts"];
export type DashboardDeliveryOverview = SmeDashboard["deliveryOverview"];
export type DashboardMonthlyCost = SmeDashboard["monthlyCosts"][number];
export type DashboardOrder = z.infer<typeof dashboardOrderSchema>;
