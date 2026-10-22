import { Check } from "lucide-react";
const labels: Record<string, string> = {
  CREATED: "Created", PICKED_UP: "Picked up", IN_TRANSIT: "In transit", OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered", FAILED: "Failed", CANCELLED: "Cancelled",
};
export function parcelStatusLabel(status: string) { return Object.hasOwn(labels, status) ? labels[status] : status; }
export function ParcelStatusBadge({ status }: { status: string }) {
  const tone = status === "DELIVERED" || status === "PICKED_UP" ? "success"
    : status === "FAILED" ? "danger" : status === "OUT_FOR_DELIVERY" ? "warning"
    : status === "IN_TRANSIT" ? "info" : "neutral";
  return <span className="status-badge" data-tone={tone}>{status === "DELIVERED" ? <Check aria-hidden="true" className="size-3" /> : <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}{parcelStatusLabel(status)}</span>;
}
