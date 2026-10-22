"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser, restoreCurrentUser } from "../hooks/use-current-user";
import { roleRoutes, type UserRole } from "../role-routes";
import { SessionSplash } from "./session-splash";

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
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-6 py-12">
        <div
          role="alert"
          className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_40px_rgba(27,47,90,0.08)]"
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#FEE2E2] text-[#DC2626]">
            <ShieldAlert aria-hidden="true" className="size-6" />
          </span>
          <h1 className="mt-4 text-[18px] font-bold text-[#1B2F5A]">We couldn’t verify your session</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B7280]">
            Check your connection and try again. If this keeps happening, sign out and sign back in.
          </p>
          <Button variant="brand" className="mt-5 w-full" onClick={() => session.retry()}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Retry
          </Button>
        </div>
      </main>
    );
  if (
    !sessionVerified ||
    session.status !== "authenticated" ||
    session.user?.role !== role
  )
    return <SessionSplash />;
  return children;
}
