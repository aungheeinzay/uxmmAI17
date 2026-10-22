import type { Metadata } from "next";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResendVerificationForm } from "@/features/auth/components/resend-verification-form";

export const metadata: Metadata = { title: "Check your email | SURFERTrack" };

export default function VerificationPendingPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-4">
          <MailCheck className="size-10 text-brand" aria-hidden="true" />
          <CardTitle className="text-heading-2 font-bold tracking-tight">Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-body-md leading-relaxed text-muted-foreground">
          <p>Open the verification link sent to your email address to verify your account before signing in.</p>
          <p>If you don’t see it, check your spam folder. You can close this page while you check your inbox.</p>
          <ResendVerificationForm />
        </CardContent>
      </Card>
    </main>
  );
}
