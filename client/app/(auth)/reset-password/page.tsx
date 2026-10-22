import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Reset password | SURFERTrack", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" description="Update your password, then sign in again. Reset links expire after 15 minutes.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
