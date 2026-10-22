import type { OrderStatus, Role } from "../../generated/prisma/enums";
import type { OrderPricing } from "../providers/order-pricing";

export type CreatedOrder = OrderPricing & {
  id: string;
  orderCode: string;
  ownerId: string;
  operatorId: string;
  recipientName: string;
  phoneNumber: string;
  township: string;
  deliveryAddress: string;
  parcelWeight: string;
  parcelWeightUnit: "kg";
  codAmount: string;
  currency: string;
  senderName: string;
  deliveryInstructions: string | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  qr: ParcelQr;
};

export type ParcelQr = {
  identifier: string;
  imageDataUrl: string;
};

export type OrderQr = {
  id: string;
  orderCode: string;
  qr: ParcelQr;
};

// Summary row for the parcel list. COD is kept separate from any delivery fee.
export type ListedOrder = OrderPricing & {
  id: string;
  orderCode: string;
  recipientName: string;
  phoneNumber: string;
  township: string;
  deliveryAddress: string;
  parcelWeight: string;
  parcelWeightUnit: "kg";
  codAmount: string;
  currency: string;
  senderName: string;
  status: OrderStatus;
  createdAt: Date;
  operatorId: string | null;
  operator: { id: string; fullName: string | null } | null;
};

// Full parcel detail for one order the caller owns, including owner and delivery service.
export type OrderDetail = OrderPricing & {
  id: string;
  orderCode: string;
  ownerId: string;
  operatorId: string | null;
  recipientName: string;
  phoneNumber: string;
  township: string;
  deliveryAddress: string;
  parcelWeight: string;
  parcelWeightUnit: "kg";
  codAmount: string;
  currency: string;
  senderName: string;
  deliveryInstructions: string | null;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; fullName: string | null; phone: string | null };
  operator: { id: string; fullName: string | null; phone: string | null } | null;
};

// Response of an accepted status change: the updated parcel plus the status it moved from.
export type UpdatedOrderDetail = OrderDetail & { previousStatus: OrderStatus };

export type OrderListResult = {
  orders: ListedOrder[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  // Per-tab totals for the parcel list views, independent of the active tab, search and page.
  tabCounts: {
    all: number;
    needsPickup: number;
    exceptions: number;
  };
};

// Status-only tracking view. Contact details, financials and coordinates are deliberately excluded.
export type TrackingTimelineEntry = {
  status: OrderStatus;
  previousStatus: OrderStatus | null;
  note: string | null;
  createdAt: Date;
};

export type OrderStatusView = {
  id: string;
  orderCode: string;
  status: OrderStatus;
  timeline: TrackingTimelineEntry[];
};

export type DashboardPeriod = {
  startsAt: Date;
  endsAt: Date;
  totalShipments: number;
  totalDelivered: number;
  successRate: number;
};

export type DashboardTimelineEntry = {
  status: OrderStatus;
  previousStatus: OrderStatus | null;
  note: string | null;
  createdAt: Date;
  actor: { id: string; fullName: string | null; role: Role } | null;
};

export type DashboardRecentOrder = OrderPricing & {
  id: string;
  orderCode: string;
  recipient: { name: string; phoneNumber: string; township: string; deliveryAddress: string };
  parcel: {
    weight: string;
    weightUnit: "kg";
    codAmount: string;
    currency: string;
    deliveryInstructions: string | null;
  };
  status: OrderStatus;
  createdAt: Date;
  trackingTimeline: DashboardTimelineEntry[];
  qr: ParcelQr;
  operator: { id: string; fullName: string | null; phone: string | null } | null;
  deliveryRider: null;
};

// Monthly delivery-fee totals for the SME's own parcels, grouped by creation month.
export type DashboardMonthlyCost = {
  /** Calendar month in UTC, for example "2026-10". */
  month: string;
  /** Total server-snapshotted delivery fees in MMK. */
  cost: string;
  currency: string;
  /** Number of parcels created in the month. */
  parcels: number;
};

export type OrderDashboard = {
  totalParcels: number;
  statusCounts: Record<OrderStatus, number>;
  deliveryOverview: { thisWeek: DashboardPeriod; thisMonth: DashboardPeriod };
  monthlyCosts: DashboardMonthlyCost[];
  recentOrders: DashboardRecentOrder[];
};
