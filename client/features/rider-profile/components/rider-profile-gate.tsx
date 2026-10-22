"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRiderProfile } from "../hooks/use-rider-profile";
import { ProviderSetupRequired } from "./provider-setup-required";

export function RiderProfileGate({ children }: { children: React.ReactNode }) {
  const { profile, error, isLoading, retry } = useRiderProfile();
  const router = useRouter();
  const needsProfile = Boolean(profile?.provider && !profile.profileComplete);

  useEffect(() => {
    // Only a confirmed incomplete response redirects. Network/5xx errors never do.
    if (needsProfile) router.replace("/rider/complete-profile");
  }, [needsProfile, router]);

  if (isLoading) {
    return (
      <div role="status" className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-16 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        Checking your Rider profile…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
        <div className="rounded-2xl border bg-card p-5">
          <h1 className="text-lg font-semibold">We couldn’t check your Rider profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <p className="mt-2 text-sm text-muted-foreground">Your profile was not treated as incomplete. Retry when the service is available.</p>
        </div>
        <Button variant="outline" onClick={retry} className="min-h-11"><RefreshCw aria-hidden="true" />Retry</Button>
      </div>
    );
  }

  if (!profile) return <p role="status" className="px-4 py-16 text-sm text-muted-foreground">Loading your Rider profile…</p>;
  if (!profile.provider) return <div className="mx-auto w-full max-w-2xl px-4 py-10"><ProviderSetupRequired /></div>;
  if (!profile.profileComplete) {
    return (
      <p role="status" className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-16 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        Taking you to Rider profile setup…
      </p>
    );
  }
  return <>{children}</>;
}
