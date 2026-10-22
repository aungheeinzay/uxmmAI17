import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password | SURFERTrack", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Forgot your password?" description="Enter your registration email to request a password reset link.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
