import { RoleGuard } from "@/features/auth/components/role-guard";
import { OperatorLayout } from "@/features/operator/components/operator-layout";
export default function Layout({ children }: { children: React.ReactNode }) {
 return <RoleGuard role="OPERATOR"><OperatorLayout>{children}</OperatorLayout></RoleGuard>;
}
