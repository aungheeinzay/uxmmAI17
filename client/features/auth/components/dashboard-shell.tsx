"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "../hooks/use-logout";
import { roleRoutes, type UserRole } from "../role-routes";
export function DashboardShell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  return <main className="mx-auto min-h-svh max-w-4xl space-y-8 px-4 py-8"><nav aria-label="Workspace" className="flex flex-wrap items-center gap-4"><Link href={roleRoutes[role]}>Dashboard</Link>{role === "OPERATOR" && <Link href="/operator/riders">Rider Management</Link>}<Button variant="outline" disabled={logout.isPending} onClick={logout.logout}>{logout.isPending ? "Signing out..." : "Sign out"}</Button></nav>{logout.error && <p role="alert">{logout.error}</p>}<p className="text-sm text-muted-foreground">{user?.fullName ?? "Signed in"} ? {user?.role}</p>{children}</main>;
}
