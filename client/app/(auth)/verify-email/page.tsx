import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";

export const metadata: Metadata = { title: "Verify your email | ParcelOps AI", robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-2xl">Verify your email</CardTitle></CardHeader>
        <CardContent><VerifyEmailPanel /></CardContent>
      </Card>
    </main>
  );
}
