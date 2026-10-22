import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2, MapPin, Package, PackageCheck, Truck, XCircle } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { DashboardOrderStatus } from "../schemas/sme-dashboard.schema";

export const orderStatusMeta = {
  CREATED: { label: "Created", variant: "neutral", dot: "bg-brand", icon: Package },
  PICKED_UP: { label: "Picked up", variant: "success", dot: "bg-brand-success", icon: PackageCheck },
  IN_TRANSIT: { label: "In transit", variant: "info", dot: "bg-brand-info", icon: Truck },
  OUT_FOR_DELIVERY: { label: "Out for delivery", variant: "info", dot: "bg-brand-info", icon: MapPin },
  DELIVERED: { label: "Delivered", variant: "success", dot: "bg-brand-success", icon: CheckCircle2 },
  FAILED: { label: "Failed", variant: "danger", dot: "bg-brand-accent", icon: AlertCircle },
  CANCELLED: { label: "Cancelled", variant: "neutral", dot: "bg-muted-foreground", icon: XCircle },
} satisfies Record<DashboardOrderStatus, { label: string; variant: BadgeVariant; dot: string; icon: LucideIcon }>;

export function OrderStatusBadge({ status, className }: { status: DashboardOrderStatus; className?: string }) {
  const meta = orderStatusMeta[status];
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}
