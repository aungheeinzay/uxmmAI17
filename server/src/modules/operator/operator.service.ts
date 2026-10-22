import { AppError } from "../../lib/errors/app-error";
import { serializePricing } from "../providers/order-pricing";
import * as repository from "./operator.repository";
import type { OperatorOrdersQuery, ReceiveParcelInput } from "./operator.validation";
import type { OperatorActor, OperatorOrderRow } from "./operator.types";
import { deriveWarehouseState } from "./warehouse/warehouse.state";

export function serializeOperatorOrder<T extends OperatorOrderRow>(row: T) {
  const { parcelWeightKg, codAmount, incidents, ...rest } = row;
  return { ...rest, ...serializePricing(row), parcelWeight: parcelWeightKg.toString(), parcelWeightUnit: "kg" as const,
    codAmount: codAmount.toString(), hasIncident: (incidents?.length ?? 0) > 0 };
}
export async function listOrders(query: OperatorOrdersQuery) {
  const [rows, total] = await repository.listWithCount(query);
  return { orders: rows.map(serializeOperatorOrder), pagination: {
    page: query.page, pageSize: query.pageSize, total,
    totalPages: Math.ceil(total / query.pageSize),
  } };
}
export async function getOrder(id: string) {
  const row = await repository.findOrder(id);
  if (!row) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
  const receipt = row.statusEvents.find(event => event.previousStatus === "CREATED" && event.status === "PICKED_UP");
  const failure = [...row.statusEvents].reverse().find(event => event.status === "FAILED");
  return { ...serializeOperatorOrder(row), warehouseState: deriveWarehouseState(row.status, !!row.assignment),
    receipt: receipt ? { receivedAt: receipt.createdAt, receivedBy: receipt.actor } : null,
    failureNote: failure?.note ?? null };
}

export async function receiveParcel(actor: OperatorActor, id: string, input: ReceiveParcelInput) {
  if (actor.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may receive parcels.");
  const current = await repository.findOrder(id);
  if (!current) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
  if (current.status !== "CREATED") {
    throw new AppError(409, "STATUS_TRANSITION_NOT_ALLOWED", "Only CREATED parcels can be received.");
  }
  const updated = await repository.receiveCreatedOrder({
    orderId: current.id, ownerId: current.ownerId, actorId: actor.id, note: input.note || null,
  });
  if (!updated) throw new AppError(409, "STATUS_UPDATE_CONFLICT", "The parcel changed before it could be received. Refresh and try again.");
  return { ...serializeOperatorOrder(updated), previousStatus: "CREATED" as const };
}
