import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";

export const metadata: Metadata = { title: "Verify your email | SURFERTrack", robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email">
      <VerifyEmailPanel />
    </AuthShell>
  );
}
