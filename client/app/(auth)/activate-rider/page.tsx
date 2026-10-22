import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { RiderActivationForm } from "@/features/auth/components/rider-activation-form";

export const metadata: Metadata = { title: "Activate Rider | SURFERTrack", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ActivateRiderPage() {
  return (
    <AuthShell title="Activate your Rider account" description="Choose a password, then sign in. Invitations expire after 24 hours.">
      <RiderActivationForm />
    </AuthShell>
  );
}
