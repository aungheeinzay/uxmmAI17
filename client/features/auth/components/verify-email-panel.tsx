"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useVerifyEmail } from "../hooks/use-verify-email";
import { ResendVerificationForm } from "./resend-verification-form";

export function VerifyEmailPanel() {
  const verification = useVerifyEmail();
  if (verification.status === "success") {
    return <div className="space-y-4"><p role="status">Your email is verified. You can now sign in with your original password.</p><Button asChild className="w-full"><Link href="/login">Continue to sign in</Link></Button></div>;
  }
  return (
    <div className="space-y-5">
      <p>Confirm your email address to finish setting up your account.</p>
      {verification.error && <p role="alert" className="text-body-sm text-destructive">{verification.error}</p>}
      {verification.status === "pending" && <p role="status">Verifying your email…</p>}
      <Button className="min-h-10 w-full" disabled={!verification.canVerify} onClick={verification.verify}>Verify my email</Button>
      {verification.status === "error" && <ResendVerificationForm />}
    </div>
  );
}
