import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Reset password | SURFERTrack", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ResetPasswordPage() {
  return <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12"><Card className="w-full max-w-md"><CardHeader className="space-y-2"><CardTitle className="text-2xl">Choose a new password</CardTitle><CardDescription>Update your password, then sign in again. Reset links expire after 15 minutes.</CardDescription></CardHeader><CardContent><ResetPasswordForm /></CardContent></Card></main>;
}
