import { AppError } from "../../lib/errors/app-error";
import * as repository from "./operator.repository";
import type { OperatorOrdersQuery, ReceiveParcelInput } from "./operator.validation";
import type { OperatorActor, OperatorOrderRow } from "./operator.types";

function serialize<T extends OperatorOrderRow>(row: T) {
  const { parcelWeightKg, codAmount, ...rest } = row;
  return { ...rest, parcelWeight: parcelWeightKg.toString(), parcelWeightUnit: "kg" as const,
    codAmount: codAmount.toString() };
}
export async function listOrders(query: OperatorOrdersQuery) {
  const [rows, total] = await repository.listWithCount(query);
  return { orders: rows.map(serialize), pagination: {
    page: query.page, pageSize: query.pageSize, total,
    totalPages: Math.ceil(total / query.pageSize),
  } };
}
export async function getOrder(id: string) {
  const row = await repository.findOrder(id);
  if (!row) throw new AppError(404, "ORDER_NOT_FOUND", "Parcel not found.");
  return serialize(row);
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
  return { ...serialize(updated), previousStatus: "CREATED" as const };
}
