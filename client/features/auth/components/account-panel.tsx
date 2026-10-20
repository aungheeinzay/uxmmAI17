"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "../hooks/use-current-user";
import { useLogout } from "../hooks/use-logout";

export function AccountPanel() {
  const session = useCurrentUser();
  const logout = useLogout();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "unauthenticated" && !logout.error && !logout.isPending) router.replace("/login");
  }, [session.status, logout.error, logout.isPending, router]);

  return (
    <div className="space-y-5">
      {session.status === "loading" && <p role="status">Checking your session…</p>}
      {session.status === "error" && <><p role="alert">We couldn’t check your session. Please try again.</p><Button variant="outline" onClick={() => session.retry()}>Retry session check</Button></>}
      {session.user && <><p role="status">You’re signed in{session.user.fullName ? `, ${session.user.fullName}` : ""}.</p><p className="text-sm text-muted-foreground">Account role: {session.user.role}</p><p className="text-sm text-muted-foreground">Your account is ready. Workspace features will be added here later.</p></>}
      {logout.error && <p role="alert" className="text-sm text-destructive">{logout.error}</p>}
      {(session.user || logout.error || logout.isPending) && <Button variant="outline" disabled={logout.isPending} onClick={logout.logout} className="min-h-10 w-full">{logout.isPending ? "Signing out…" : "Sign out"}</Button>}
    </div>
  );
}
