"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { resetPasswordSchema, type ResetPasswordValues } from "../schemas/auth.schema";
import { useActivateRider } from "../hooks/use-activate-rider";

export function RiderActivationForm() {
  const recovery = useActivateRider();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { newPassword: "", confirmPassword: "" } });
  const pending = recovery.status === "pending";

  if (recovery.status === "success") return <div className="space-y-5"><p role="status">Your Rider account is activated. Redirecting to sign in…</p><Button className="min-h-11 w-full" onClick={recovery.goToLogin}>Continue to sign in</Button></div>;
  if (recovery.linkStatus === "loading") return <p role="status">Checking your invitation link…</p>;
  if (recovery.linkStatus === "invalid") return <div className="space-y-5"><p role="alert" className="text-body-sm text-destructive">{recovery.error ?? "This invitation link is missing or invalid. Request a new invitation email from your Operator."}</p><Button asChild className="min-h-11 w-full"><Link href="/login">Back to sign in</Link></Button></div>;

  return (
    <form noValidate aria-busy={pending} className="space-y-5" onSubmit={handleSubmit(async ({ newPassword }) => { if (await recovery.submit(newPassword)) reset(); })}>
      {recovery.error && <Alert variant="destructive" role="alert"><AlertTitle>We could not confirm activation</AlertTitle><AlertDescription>{recovery.error}</AlertDescription></Alert>}
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <div className="relative"><Input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required disabled={pending} aria-invalid={!!errors.newPassword} aria-describedby={`new-password-hint${errors.newPassword ? " new-password-error" : ""}`} className="h-11 pr-12" {...register("newPassword")} /><Button type="button" variant="ghost" size="icon" className="absolute top-1.5 right-1.5" disabled={pending} aria-label={showPassword ? "Hide new password" : "Show new password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button></div>
        <p id="new-password-hint" className="text-body-sm text-muted-foreground">Use 8–128 characters. Choose a unique password.</p>
        {errors.newPassword && <p id="new-password-error" role="alert" className="text-body-sm text-destructive">{errors.newPassword.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirm new password</Label>
        <div className="relative"><Input id="confirm-new-password" type={showConfirmation ? "text" : "password"} autoComplete="new-password" required disabled={pending} aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? "confirm-new-password-error" : undefined} className="h-11 pr-12" {...register("confirmPassword")} /><Button type="button" variant="ghost" size="icon" className="absolute top-1.5 right-1.5" disabled={pending} aria-label={showConfirmation ? "Hide confirmed new password" : "Show confirmed new password"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(!showConfirmation)}>{showConfirmation ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button></div>
        {errors.confirmPassword && <p id="confirm-new-password-error" role="alert" className="text-body-sm text-destructive">{errors.confirmPassword.message}</p>}
      </div>
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>{pending ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />Activating account...</> : "Activate Rider account"}</Button>
      <p className="text-body-md">Invitation expired? Ask your Operator for a new invitation.</p>
    </form>
  );
}
