import { RoleGuard } from "@/features/auth/components/role-guard";
import { SessionSplash } from "@/features/auth/components/session-splash";
import { Suspense } from "react";
import { OperatorLayout } from "@/features/operator/components/operator-layout";
export default function Layout({ children }: { children: React.ReactNode }) {
 return <Suspense fallback={<SessionSplash />}><RoleGuard role="OPERATOR"><OperatorLayout>{children}</OperatorLayout></RoleGuard></Suspense>;
}
