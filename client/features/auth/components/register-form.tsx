"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRegister } from "../hooks/use-register";
import {
  registerSchema,
  type RegisterFormValues,
} from "../schemas/auth.schema";
import { ResendVerificationForm } from "./resend-verification-form";

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const registration = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  return (
    <>
      <form
        noValidate
        aria-busy={registration.isPending}
        onSubmit={handleSubmit(({ email, password }) =>
          registration.register({ email, password }),
        )}
        className="space-y-5"
      >
        {registration.error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Registration needs your attention</AlertTitle>
            <AlertDescription>{registration.error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            disabled={registration.isPending}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="h-11"
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={registration.isPending}
              aria-invalid={!!errors.password}
              aria-describedby={`password-hint${errors.password ? " password-error" : ""}`}
              className="h-11 pr-12"
              {...register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1.5"
              disabled={registration.isPending}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
            </Button>
          </div>
          <p id="password-hint" className="text-xs text-muted-foreground">
            Use at least 8 characters. Choose a unique password.
          </p>
          {errors.password && (
            <p
              id="password-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmation ? "text" : "password"}
              autoComplete="new-password"
              required
              disabled={registration.isPending}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? "confirmation-error" : undefined
              }
              className="h-11 pr-12"
              {...register("confirmPassword")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1.5"
              disabled={registration.isPending}
              aria-label={
                showConfirmation
                  ? "Hide confirmed password"
                  : "Show confirmed password"
              }
              aria-pressed={showConfirmation}
              onClick={() => setShowConfirmation(!showConfirmation)}
            >
              {showConfirmation ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
            </Button>
          </div>
          {errors.confirmPassword && (
            <p
              id="confirmation-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={registration.isPending}
          className="h-11 w-full gap-2"
        >
          {registration.isPending ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="motion-safe:animate-spin"
              />
              {registration.status === "success"
                ? "Opening next step…"
                : "Creating account…"}
            </>
          ) : (
            <>
              Create SME account
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
        <p role="status" className="sr-only">
          {registration.isPending ? "Registration in progress. Please wait." : ""}
        </p>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
          Email verification is required before signing in.
        </p>
        <p className="border-t pt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </form>
      {registration.recoveryEmail && (
        <div className="mt-5">
          <ResendVerificationForm
            key={registration.recoveryEmail}
            initialEmail={registration.recoveryEmail}
          />
        </div>
      )}
    </>
  );
}
