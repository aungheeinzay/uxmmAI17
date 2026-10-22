"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema } from "../schemas/auth.schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResendVerification } from "../hooks/use-resend-verification";

const emailSchema = z.object({ email: registerSchema.shape.email });

export function ResendVerificationForm({ initialEmail = "" }: { initialEmail?: string }) {
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema), defaultValues: { email: initialEmail },
  });
  const verification = useResendVerification();
  const disabled = verification.isPending || verification.cooldown > 0;

  return (
    <form noValidate onSubmit={handleSubmit(({ email }) => verification.resend(email))} aria-busy={verification.isPending} className="space-y-3 border-t pt-5 text-left">
      <h2 className="font-medium text-foreground">Need a new verification link?</h2>
      <p className="text-body-md text-muted-foreground">Enter the email you used to register. Your original password stays the same. Wait at least a minute after the last email request.</p>
      <Label htmlFor="verification-email">Registration email</Label>
      <Input id="verification-email" type="email" autoComplete="email" required disabled={verification.isPending} aria-invalid={!!errors.email} aria-describedby={errors.email ? "verification-email-error" : undefined} {...register("email")} />
      {errors.email && <p id="verification-email-error" role="alert" className="text-body-sm text-destructive">{errors.email.message}</p>}
      {verification.error && <p role="alert" className="text-body-sm text-destructive">{verification.error}</p>}
      {verification.message && <p role="status" className="text-body-md text-foreground">{verification.message}</p>}
      <Button type="submit" variant="outline" disabled={disabled} className="min-h-10 w-full">
        {verification.isPending ? "Requesting link…" : verification.cooldown > 0 ? `Request again in ${verification.cooldown}s` : "Send verification link"}
      </Button>
    </form>
  );
}
