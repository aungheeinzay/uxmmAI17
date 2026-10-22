"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "../hooks/use-logout";
import { roleRoutes, type UserRole } from "../role-routes";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { BrandLogo } from "@/components/shared/brand-logo";
export function DashboardShell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  return <main className="mx-auto min-h-svh w-full max-w-4xl space-y-8 px-4 py-8"><header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5"><Link href={roleRoutes[role]} className="flex items-center gap-2.5 text-xl"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white p-1 shadow-sm"><BrandLogo className="h-6 w-auto" priority /></span><BrandWordmark /></Link><p className="text-sm text-muted-foreground">Know where it is.</p></header><nav aria-label="Workspace" className="flex flex-wrap items-center gap-4"><Link href={roleRoutes[role]} className="font-semibold text-primary">Dashboard</Link>{role === "OPERATOR" && <Link href="/operator/riders">Rider Management</Link>}<Button variant="outline" disabled={logout.isPending} onClick={logout.logout}>{logout.isPending ? "Signing out..." : "Sign out"}</Button></nav>{logout.error && <p role="alert">{logout.error}</p>}<p className="text-sm text-muted-foreground">{user?.fullName ?? "Signed in"} · {user?.role}</p>{children}</main>;
}
