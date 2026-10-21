const labels: Record<string, string> = {
  CREATED: "Created", PICKED_UP: "Picked up", IN_TRANSIT: "In transit", OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered", FAILED: "Failed", CANCELLED: "Cancelled",
};
export function parcelStatusLabel(status: string) { return Object.hasOwn(labels, status) ? labels[status] : status; }
export function ParcelStatusBadge({ status }: { status: string }) {
  const color = status === "DELIVERED" ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200"
    : status === "FAILED" ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
    : ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(status) ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200"
    : "bg-muted text-muted-foreground";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{parcelStatusLabel(status)}</span>;
}
