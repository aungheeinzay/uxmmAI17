import Link from "next/link";
import { ParcelStatusBadge } from "./parcel-status-badge";
import { formatParcelDate, formatParcelDecimal } from "../format";
import type { OperatorOrder } from "../types/operator-order.types";
import { ReceiveParcelDialog } from "./receive-parcel-dialog";
import { warehouseLabels, type WarehouseOrder } from "../types/warehouse.types";

export function IncomingParcelsTable({ orders, returnTo, warehouse = false }: { orders: (OperatorOrder & Partial<Pick<WarehouseOrder, "warehouseState" | "assignment">>)[]; returnTo?: string; warehouse?: boolean }) {
  return <div className="overflow-x-auto rounded-xl border bg-card" tabIndex={0} role="region" aria-label={warehouse ? "Received parcels table" : "Incoming parcels table"}>
    <table className="w-full min-w-[1050px] text-left text-sm">
      <caption className="sr-only">SME parcels, newest first. Dates shown in Myanmar time.</caption>
      <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr>
        {(warehouse ? ["Order / recipient", "Township / delivery address", "COD", "Order status", "Warehouse state", "Assigned Rider", "Created (MMT)", "Actions"] : ["Order / recipient", "Township", "Seller", "Operator", "COD", "Status", "Created (MMT)", "Details", "Receiving"]).map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
      </tr></thead>
      <tbody className="divide-y">{orders.map(order => <tr key={order.id} className="hover:bg-muted/30">
        <td className="px-4 py-4"><p className="font-mono text-xs font-semibold">{order.orderCode}</p><p className="mt-1">{order.recipientName}</p>{order.hasIncident && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Incident reported</span>}</td>
        <td className="px-4 py-4">{order.township}{warehouse && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{order.deliveryAddress}</p>}</td>
        {warehouse ? <>
        <td className="whitespace-nowrap px-4 py-4 tabular-nums">{formatParcelDecimal(order.codAmount)} {order.currency}</td>
        <td className="px-4 py-4"><ParcelStatusBadge status={order.status} /></td>
        <td className="px-4 py-4"><span className="rounded-full bg-muted px-2 py-1 text-xs">{order.warehouseState ? warehouseLabels[order.warehouseState] : "Unavailable"}</span></td>
        <td className="px-4 py-4">{order.assignment?.rider.fullName ?? (order.assignment ? "Name unavailable" : "No Rider assigned")}</td>
        </> : <>
        <td className="max-w-48 break-words px-4 py-4">{order.owner.fullName ?? order.senderName}</td>
        <td className="px-4 py-4">{(order.operator?.fullName ?? "Not assigned")}</td>
        <td className="whitespace-nowrap px-4 py-4 tabular-nums">{formatParcelDecimal(order.codAmount)} {order.currency}</td>
        <td className="px-4 py-4"><ParcelStatusBadge status={order.status} /></td>
        </>}
        <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground"><time dateTime={order.createdAt}>{formatParcelDate(order.createdAt)}</time></td>
        <td className="space-y-2 px-4 py-4"><Link className="block whitespace-nowrap font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2" aria-label={`View details for ${order.orderCode}`} href={`/operator/parcels/${order.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>{warehouse && order.warehouseState ? ({ UNASSIGNED: "View Details", ASSIGNED: "View Assignment", DISPATCHED: "View Delivery Status", COMPLETED: "View Details", EXCEPTION: "View Failure" }[order.warehouseState]) : "View details"}</Link>{warehouse && order.warehouseState === "UNASSIGNED" && <Link className="block whitespace-nowrap text-sm font-medium text-primary underline" href={`/operator/assignments?orderId=${order.id}&returnTo=${encodeURIComponent(returnTo ?? "/operator/warehouse")}`}>Assign Rider</Link>}</td>
        {!warehouse && <td className="px-4 py-4"><ReceiveParcelDialog order={order} /></td>}
      </tr>)}</tbody>
    </table>
  </div>;
}
