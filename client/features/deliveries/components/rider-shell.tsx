"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { RiderAvatar } from "@/features/rider-profile/components/rider-avatar";
import { useAuthStore } from "@/stores/auth.store";
import { useLogout } from "@/features/auth/hooks/use-logout";

export function RiderShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(state => state.user);
  const logout = useLogout();

  return (
    <div className="min-h-svh bg-[#f4f7fb]">
      <header className="bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/rider" className="text-lg"><BrandWordmark inverse /></Link>
          <div className="flex items-center gap-1.5">
            <Link href="/rider/complete-profile" aria-label="Rider profile" className="rounded-full ring-2 ring-white/30 transition hover:ring-white/60">
              <RiderAvatar name={user?.fullName} className="size-9 bg-white/15 text-white" />
            </Link>
            <Button
              variant="ghost"
              size="sm"
              disabled={logout.isPending}
              onClick={logout.logout}
              className="min-h-9 text-white hover:bg-white/10 hover:text-white"
            >
              <LogOut aria-hidden="true" />
              <span className="hidden sm:inline">{logout.isPending ? "Signing out…" : "Sign out"}</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        {logout.error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{logout.error}</p>}
        {children}
      </main>
    </div>
  );
}
