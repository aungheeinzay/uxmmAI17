import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password | SURFERTrack", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ForgotPasswordPage() {
  return <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12"><Card className="w-full max-w-md"><CardHeader className="space-y-2"><CardTitle className="text-2xl">Forgot your password?</CardTitle><CardDescription>Enter your registration email to request a password reset link.</CardDescription></CardHeader><CardContent><ForgotPasswordForm /></CardContent></Card></main>;
}
