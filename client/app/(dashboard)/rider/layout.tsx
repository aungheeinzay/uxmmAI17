import { RoleGuard } from "@/features/auth/components/role-guard";
import { DashboardShell } from "@/features/auth/components/dashboard-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
 return <RoleGuard role="RIDER"><DashboardShell role="RIDER">{children}</DashboardShell></RoleGuard>;
}
