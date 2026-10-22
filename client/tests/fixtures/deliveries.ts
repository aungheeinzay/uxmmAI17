import { operatorUser, parcel } from "./operator-orders";
import type { AssignmentDetail } from "@/features/deliveries/types/delivery.types";
export const riderUser = { ...operatorUser, id: "990e8400-e29b-41d4-a716-446655440000", role: "RIDER" as const, fullName: "Test Rider" };
export const assignment: AssignmentDetail = {
  id: "aa0e8400-e29b-41d4-a716-446655440000", orderId: parcel.id, riderId: riderUser.id, assignedById: operatorUser.id,
  assignedAt: "2026-10-21T01:00:00.000Z", rider: riderUser, assignedBy: operatorUser,
  order: { id: parcel.id, orderCode: parcel.orderCode, recipientName: parcel.recipientName, phoneNumber: parcel.phoneNumber, deliveryAddress: parcel.deliveryAddress, township: parcel.township, deliveryInstructions: null, codAmount: parcel.codAmount, currency: "MMK", status: "PICKED_UP", statusEvents: [] },
};
export const assignments = { assignments: [assignment], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };
