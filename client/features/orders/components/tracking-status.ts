import type { OrderStatus } from "../schemas/order-list.schema";
import type { StatusTimelineEntry } from "../schemas/order-status.schema";
import type { ShipmentStep, ShipmentStepIcon, ShipmentStatusTone } from "./shipment-status-panel";

export const forwardingStatuses: OrderStatus[] = [
  "CREATED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// Display labels and tones for the backend status values (CREATED, PICKED_UP, IN_TRANSIT,
// DELIVERED, FAILED, CANCELLED). The API names stay canonical; only the UI renames them.
export const shipmentStatusBadges: Record<OrderStatus, { label: string; tone: ShipmentStatusTone }> = {
  CREATED: { label: "Booked", tone: "info" },
  PICKED_UP: { label: "Picked Up", tone: "info" },
  IN_TRANSIT: { label: "In Transit", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

const shipmentStepPresentation: Record<
  OrderStatus,
  { title: string; subtitle: string; icon: ShipmentStepIcon }
> = {
  CREATED: { title: "Booked", subtitle: "Order confirmed", icon: "booked" },
  PICKED_UP: { title: "Picked Up", subtitle: "Handed over to our delivery team", icon: "picked" },
  IN_TRANSIT: {
    title: "In Transit to Destination",
    subtitle: "Moving to the delivery hub",
    icon: "transit",
  },
  OUT_FOR_DELIVERY: {
    title: "Out for Delivery",
    subtitle: "Rider is on the way to the recipient",
    icon: "transit",
  },
  DELIVERED: {
    title: "Delivered",
    subtitle: "Get customer signature to confirm delivery",
    icon: "delivered",
  },
  FAILED: { title: "Delivery Failed", subtitle: "We couldn't complete this delivery", icon: "exception" },
  CANCELLED: { title: "Cancelled", subtitle: "This parcel was cancelled", icon: "exception" },
};

function formatStepTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/**
 * Builds the delivery progress shown in the shipment status panel: every reached
 * step plus the next pending one. Terminal failures replace the whole flow.
 */
export function buildShipmentSteps(timeline: StatusTimelineEntry[], currentStatus: OrderStatus): ShipmentStep[] {
  const reached = new Map<OrderStatus, string>();
  for (const entry of timeline) {
    if (!reached.has(entry.status)) reached.set(entry.status, entry.createdAt);
  }

  if (currentStatus === "FAILED" || currentStatus === "CANCELLED") {
    const presentation = shipmentStepPresentation[currentStatus];
    const timestamp = reached.get(currentStatus);
    return [
      {
        key: currentStatus,
        title: presentation.title,
        subtitle: presentation.subtitle,
        timestamp: timestamp ? formatStepTimestamp(timestamp) : null,
        icon: presentation.icon,
        state: "failed",
      },
    ];
  }

  const currentIndex = forwardingStatuses.indexOf(currentStatus);
  const visible = forwardingStatuses.slice(0, Math.min(currentIndex + 2, forwardingStatuses.length));

  return visible.map((status, index) => {
    const presentation = shipmentStepPresentation[status];
    const timestamp = reached.get(status);
    const isNextPendingStep = index === visible.length - 1 && index > currentIndex;
    return {
      key: status,
      title: presentation.title,
      subtitle: presentation.subtitle,
      timestamp: timestamp ? formatStepTimestamp(timestamp) : null,
      icon: presentation.icon,
      state: isNextPendingStep ? ("current" as const) : ("completed" as const),
    };
  });
}
