"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCurrentUser, restoreCurrentUser } from "../hooks/use-current-user";
import { roleRoutes, type UserRole } from "../role-routes";

export function RoleGuard({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const session = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void restoreCurrentUser().then(() => { if (active) setVerifiedPath(pathname); });
    return () => { active = false; };
  }, [pathname]);
  useEffect(() => {
    if (session.status === "unauthenticated") router.replace("/login");
    else if (session.user && session.user.role !== role) router.replace(roleRoutes[session.user.role]);
  }, [session.status, session.user, role, router]);
  if (session.status === "error") return <div role="alert">We could not verify your session. <Button onClick={() => session.retry()}>Retry</Button></div>;
  if (verifiedPath !== pathname || session.status !== "authenticated" || session.user?.role !== role) return <p role="status">Checking your session...</p>;
  return children;
}
