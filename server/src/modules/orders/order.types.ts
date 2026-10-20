import type { OrderStatus } from "../../generated/prisma/enums";

export type CreatedOrder = {
  id: string;
  orderCode: string;
  ownerId: string;
  deliveryServiceId: string;
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
  deliveryService: { id: string; name: string };
};

// Full parcel detail for one order the caller owns, including owner and delivery service.
export type OrderDetail = {
  id: string;
  orderCode: string;
  ownerId: string;
  deliveryServiceId: string;
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
  deliveryService: { id: string; name: string; isActive: boolean };
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
