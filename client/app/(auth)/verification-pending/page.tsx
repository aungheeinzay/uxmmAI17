import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResendVerificationForm } from "@/features/auth/components/resend-verification-form";

export const metadata: Metadata = { title: "Check your email | SURFERTrack" };

export default function VerificationPendingPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-4">
          <MailCheck className="size-10" aria-hidden="true" />
          <CardTitle className="text-2xl">Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>Open the verification link sent to your email address to verify your account before signing in.</p>
          <p>If you don’t see it, check your spam folder. You can close this page while you check your inbox.</p>
          <ResendVerificationForm />
        </CardContent>
      </Card>
    </main>
  );
}
