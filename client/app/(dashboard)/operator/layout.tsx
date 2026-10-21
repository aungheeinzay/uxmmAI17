import { RoleGuard } from "@/features/auth/components/role-guard";
import { Suspense } from "react";
import { OperatorLayout } from "@/features/operator/components/operator-layout";
export default function Layout({ children }: { children: React.ReactNode }) {
 return <Suspense fallback={<p role="status">Checking your session…</p>}><RoleGuard role="OPERATOR"><OperatorLayout>{children}</OperatorLayout></RoleGuard></Suspense>;
}
