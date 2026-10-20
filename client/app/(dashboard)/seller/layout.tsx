import { RoleGuard } from "@/features/auth/components/role-guard";
import { DashboardShell } from "@/features/auth/components/dashboard-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
 return <RoleGuard role="SME"><DashboardShell role="SME">{children}</DashboardShell></RoleGuard>;
}
