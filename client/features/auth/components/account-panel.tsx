"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "../hooks/use-current-user";
import { useLogout } from "../hooks/use-logout";
import { roleLabels } from "../role-routes";

function initialsFor(name: string | null) {
  if (!name) return "ST";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || "ST";
}

export function AccountPanel() {
  const session = useCurrentUser();
  const logout = useLogout();
  const router = useRouter();
  useEffect(() => {
    if (session.status === "unauthenticated" && !logout.error && !logout.isPending) router.replace("/login");
  }, [session.status, logout.error, logout.isPending, router]);

  return (
    <div className="space-y-6">
      {session.status === "loading" && (
        <p role="status" className="text-body-md text-muted-foreground">
          Checking your session…
        </p>
      )}
      {session.status === "error" && (
        <div className="space-y-3">
          <Alert variant="destructive" role="alert">
            <AlertDescription>We couldn’t check your session. Please try again.</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => session.retry()}>
            Retry session check
          </Button>
        </div>
      )}
      {session.user && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-body-lg font-semibold text-brand">
              {initialsFor(session.user.fullName)}
            </span>
            <div className="space-y-1">
              <p className="text-body-lg font-semibold text-foreground">{session.user.fullName ?? "Signed in"}</p>
              <Badge variant="primary">{roleLabels[session.user.role]}</Badge>
            </div>
          </div>
          <p className="text-body-md text-muted-foreground">
            Your account is ready. Workspace features will be added here later.
          </p>
        </div>
      )}
      {logout.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{logout.error}</AlertDescription>
        </Alert>
      )}
      {(session.user || logout.error || logout.isPending) && (
        <Button variant="outline" disabled={logout.isPending} onClick={logout.logout} className="min-h-10 w-full gap-2">
          <LogOut aria-hidden="true" />
          {logout.isPending ? "Signing out…" : "Sign out"}
        </Button>
      )}
    </div>
  );
}
