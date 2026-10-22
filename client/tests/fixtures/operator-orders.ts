import type { OperatorOrderDetail, OperatorOrderList } from "@/features/operator/types/operator-order.types";
export const operatorUser = { id: "550e8400-e29b-41d4-a716-446655440000", role: "OPERATOR" as const, fullName: "Test Operator", phone: null };
export const parcel: OperatorOrderDetail = {
  id: "660e8400-e29b-41d4-a716-446655440000", orderCode: "PODEAD000000000001", ownerId: operatorUser.id,
  recipientName: "Test Recipient", phoneNumber: "TEST-NOT-DIALABLE", township: "Tamwe", deliveryAddress: "Fictional test lane",
  senderName: "Test Sender", parcelWeight: "1.250", parcelWeightUnit: "kg", codAmount: "25000.50", currency: "MMK",
  status: "CREATED", createdAt: "2026-10-21T00:00:00.000Z", updatedAt: "2026-10-21T01:00:00.000Z",
  deliveryInstructions: null, owner: { id: operatorUser.id, fullName: "Test Seller", phone: null }, hasIncident: false,
  operatorId: "770e8400-e29b-41d4-a716-446655440000",
  operator: { id: "770e8400-e29b-41d4-a716-446655440000", fullName: "Assigned Operator", phone: null },
  statusEvents: [{ id: "880e8400-e29b-41d4-a716-446655440000", previousStatus: "CREATED", status: "PICKED_UP",
    createdAt: "2026-10-21T01:00:00.000Z", note: "Test history", actor: { id: operatorUser.id, fullName: "Test Actor" } }],
};
export const parcelList: OperatorOrderList = { orders: [parcel], pagination: { page: 1, pageSize: 20, total: 41, totalPages: 3 } };
