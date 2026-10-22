import { prisma } from "../../../config/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { buildWhere, orderSelect } from "../operator.repository";
import type { WarehouseQuery } from "./warehouse.validation";
import type { WarehouseState } from "./warehouse.state";

const stateFilters: Record<WarehouseState, Prisma.ParcelOrderWhereInput> = {
  UNASSIGNED: { status: "PICKED_UP", assignment: { is: null } },
  ASSIGNED: { status: "PICKED_UP", assignment: { isNot: null } },
  DISPATCHED: { status: { in: ["IN_TRANSIT", "OUT_FOR_DELIVERY"] } },
  COMPLETED: { status: "DELIVERED" }, EXCEPTION: { status: "FAILED" },
};
export function warehouseWhere(query: WarehouseQuery): Prisma.ParcelOrderWhereInput {
  return { ...buildWhere(query), ...(query.warehouseState ? stateFilters[query.warehouseState]
    : { status: { in: ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"] } }) };
}
export function listParcels(query: WarehouseQuery) {
  const where = warehouseWhere(query);
  return prisma.$transaction([
    prisma.parcelOrder.findMany({ where, select: { ...orderSelect, assignment: { select: {
      id: true, riderId: true, assignedById: true, assignedAt: true,
      rider: { select: { id: true, fullName: true, phone: true } },
    } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.parcelOrder.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export function overviewCounts() {
  // Five aggregate counts from one consistent snapshot, never counts of a loaded page.
  return prisma.$transaction([
    prisma.parcelOrder.count({ where: { owner: { role: "SME" }, ...stateFilters.UNASSIGNED } }),
    prisma.parcelOrder.count({ where: { owner: { role: "SME" }, ...stateFilters.ASSIGNED } }),
    prisma.parcelOrder.count({ where: { owner: { role: "SME" }, ...stateFilters.DISPATCHED } }),
    prisma.parcelOrder.count({ where: { owner: { role: "SME" }, ...stateFilters.COMPLETED } }),
    prisma.parcelOrder.count({ where: { owner: { role: "SME" }, ...stateFilters.EXCEPTION } }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
