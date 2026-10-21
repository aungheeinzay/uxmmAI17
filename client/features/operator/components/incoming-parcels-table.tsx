import Link from "next/link";
import { ParcelStatusBadge } from "./parcel-status-badge";
import { formatParcelDate, formatParcelDecimal } from "../format";
import type { OperatorOrder } from "../types/operator-order.types";

export function IncomingParcelsTable({ orders, returnTo }: { orders: OperatorOrder[]; returnTo?: string }) {
  return <div className="overflow-x-auto rounded-xl border bg-card" tabIndex={0} role="region" aria-label="Incoming parcels table">
    <table className="w-full min-w-[1050px] text-left text-sm">
      <caption className="sr-only">SME parcels, newest first. Dates shown in Myanmar time.</caption>
      <thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr>
        {["Order / recipient", "Township", "Seller", "Operator", "COD", "Status", "Created (MMT)", "Details"].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
      </tr></thead>
      <tbody className="divide-y">{orders.map(order => <tr key={order.id} className="hover:bg-muted/30">
        <td className="px-4 py-4"><p className="font-mono text-xs font-semibold">{order.orderCode}</p><p className="mt-1">{order.recipientName}</p></td>
        <td className="px-4 py-4">{order.township}</td>
        <td className="max-w-48 break-words px-4 py-4">{order.owner.fullName ?? order.senderName}</td>
        <td className="px-4 py-4">{(order.operator?.fullName ?? "Not assigned")}</td>
        <td className="whitespace-nowrap px-4 py-4 tabular-nums">{formatParcelDecimal(order.codAmount)} {order.currency}</td>
        <td className="px-4 py-4"><ParcelStatusBadge status={order.status} /></td>
        <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground"><time dateTime={order.createdAt}>{formatParcelDate(order.createdAt)}</time></td>
        <td className="px-4 py-4"><Link className="whitespace-nowrap font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2" aria-label={`View details for ${order.orderCode}`} href={`/operator/parcels/${order.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>View details</Link></td>
      </tr>)}</tbody>
    </table>
  </div>;
}
