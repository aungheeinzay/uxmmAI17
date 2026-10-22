import { LayoutDashboard, PackageOpen, Warehouse, Users, Route, MapPin, ChartNoAxesCombined, Settings, TriangleAlert } from "lucide-react";
export const operatorNavigation = [
 { title: "Dashboard", href: "/operator", icon: LayoutDashboard },
 { title: "Incoming Parcels", href: "/operator/parcels", icon: PackageOpen },
 { title: "Warehouse", href: "/operator/warehouse", icon: Warehouse },
 { title: "Delivery Providers", href: "/operator/delivery-providers", icon: PackageOpen },
 { title: "Rider Management", href: "/operator/riders", icon: Users },
 { title: "Rider Assignment", href: "/operator/assignments", icon: Route },
 { title: "Delivery Monitoring", href: "/operator/monitoring", icon: MapPin },
 { title: "Incidents", href: "/operator/incidents", icon: TriangleAlert },
 { title: "Reports", href: "/operator/reports", icon: ChartNoAxesCombined },
 { title: "Settings", href: "/operator/settings", icon: Settings },
] as const;
export function isOperatorRouteActive(path: string, href: string) {
 return path === href || (href !== "/operator" && path.startsWith(href + "/"));
}
