import { AppError } from "../../../lib/errors/app-error";
import type { OperatorActor } from "../operator.types";
import { serializeOperatorOrder } from "../operator.service";
import { deriveWarehouseState } from "./warehouse.state";
import * as repository from "./warehouse.repository";
import type { WarehouseQuery } from "./warehouse.validation";
function authorize(actor: OperatorActor) {
  if (actor.role !== "OPERATOR") throw new AppError(403, "FORBIDDEN", "Only Operators may inspect warehouse operations.");
}
export async function overview(actor: OperatorActor) {
  authorize(actor);
  const [unassigned, assignedAwaitingDispatch, dispatched, completed, exceptions] = await repository.overviewCounts();
  return { scope: "ALL_TIME" as const, unassigned, assignedAwaitingDispatch,
    receivedAwaitingDispatch: unassigned + assignedAwaitingDispatch, dispatched, completed, exceptions };
}
export async function parcels(actor: OperatorActor, query: WarehouseQuery) {
  authorize(actor);
  const [rows, total] = await repository.listParcels(query);
  return { orders: rows.map(row => ({ ...serializeOperatorOrder(row), warehouseState: deriveWarehouseState(row.status, !!row.assignment) })),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) } };
}
