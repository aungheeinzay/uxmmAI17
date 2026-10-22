"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCurrentUser, restoreCurrentUser } from "../hooks/use-current-user";
import { roleRoutes, type UserRole } from "../role-routes";

export function RoleGuard({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const session = useCurrentUser();
  const router = useRouter();
  const [sessionVerified, setSessionVerified] = useState(false);
  useEffect(() => {
    let active = true;
    void restoreCurrentUser().then(() => {
      if (active) setSessionVerified(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (session.status === "unauthenticated") router.replace("/login");
    else if (session.user && session.user.role !== role)
      router.replace(roleRoutes[session.user.role]);
  }, [session.status, session.user, role, router]);
  if (session.status === "error")
    return (
      <div role="alert">
        We could not verify your session.{" "}
        <Button onClick={() => session.retry()}>Retry</Button>
      </div>
    );
  if (
    !sessionVerified ||
    session.status !== "authenticated" ||
    session.user?.role !== role
  )
    return <p role="status">Checking your session...</p>;
  return children;
}
