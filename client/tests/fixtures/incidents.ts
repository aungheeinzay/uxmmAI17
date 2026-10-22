import type { Incident, IncidentList } from "@/features/incidents/types/incident.types";
import { assignment, riderUser } from "./deliveries";
import { operatorUser } from "./operator-orders";

export const providerId = "dd0e8400-e29b-41d4-a716-446655440000";
export const incident: Incident = {
  id: "cc0e8400-e29b-41d4-a716-446655440000",
  orderId: assignment.orderId, riderId: riderUser.id, assignmentId: assignment.id, providerId,
  type: "DAMAGED", reason: "Parcel arrived crushed", description: "Outer carton torn on one corner.",
  status: "OPEN", reviewedAt: null, reviewedById: null,
  createdAt: "2026-10-21T02:00:00.000Z", updatedAt: "2026-10-21T02:00:00.000Z",
  rider: { id: riderUser.id, fullName: riderUser.fullName, phone: riderUser.phone ?? null },
  reviewedBy: null,
  order: {
    id: assignment.order.id, orderCode: assignment.order.orderCode, recipientName: assignment.order.recipientName,
    township: assignment.order.township, deliveryAddress: assignment.order.deliveryAddress,
    status: assignment.order.status, deliveryProviderId: providerId,
  },
};
export const incidentList: IncidentList = {
  incidents: [incident], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
};
export const reviewedIncident: Incident = {
  ...incident, status: "REVIEWED", reviewedAt: "2026-10-21T03:00:00.000Z", reviewedById: operatorUser.id,
  reviewedBy: { id: operatorUser.id, fullName: operatorUser.fullName, phone: null },
  updatedAt: "2026-10-21T03:00:00.000Z",
};
