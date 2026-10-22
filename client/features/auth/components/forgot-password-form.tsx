"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas/auth.schema";
import { useForgotPassword } from "../hooks/use-forgot-password";

export function ForgotPasswordForm() {
  const recovery = useForgotPassword();
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  return (
    <form noValidate aria-busy={recovery.isPending} onSubmit={handleSubmit(({ email }) => recovery.submit(email))} className="space-y-5">
      {recovery.isSuccess && <Alert role="status"><AlertTitle>Check your email</AlertTitle><AlertDescription>If an account exists for this email, a password reset link has been requested. Check your inbox and spam folder. If no email arrives, wait a minute before requesting another link.</AlertDescription></Alert>}
      {recovery.error && <Alert variant="destructive" role="alert"><AlertTitle>We couldn’t complete your request</AlertTitle><AlertDescription>{recovery.error}</AlertDescription></Alert>}
      <div className="space-y-2"><Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" type="email" autoComplete="email" required disabled={recovery.isPending} aria-invalid={!!errors.email} aria-describedby={errors.email ? "recovery-email-error" : undefined} className="h-11" {...register("email")} />{errors.email && <p id="recovery-email-error" role="alert" className="text-body-sm text-destructive">{errors.email.message}</p>}</div>
      <Button type="submit" className="min-h-11 w-full" disabled={recovery.isPending || recovery.cooldown > 0}>{recovery.isPending ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />Requesting link…</> : recovery.cooldown > 0 ? `Request again in ${recovery.cooldown}s` : "Send reset link"}</Button>
      <p className="text-center text-body-md"><Link href="/login" className="rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">Back to sign in</Link></p>
    </form>
  );
}
