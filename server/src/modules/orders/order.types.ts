import type { OrderStatus, Role } from "../../generated/prisma/enums";

export type CreatedOrder = {
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
export type ListedOrder = {
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

// Full parcel detail for one order the caller owns, including owner and Operator.
export type OrderDetail = {
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

export type DashboardRecentOrder = {
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

export type OrderDashboard = {
  totalParcels: number;
  statusCounts: Record<OrderStatus, number>;
  deliveryOverview: { thisWeek: DashboardPeriod; thisMonth: DashboardPeriod };
  recentOrders: DashboardRecentOrder[];
};
