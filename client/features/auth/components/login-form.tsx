"use client";

import { roleRoutes } from "../role-routes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loginSchema, type LoginFormValues } from "../schemas/auth.schema";
import { useLogin } from "../hooks/use-login";
import { useCurrentUser } from "../hooks/use-current-user";
import { ResendVerificationForm } from "./resend-verification-form";

export function LoginForm() {
  const [visible, setVisible] = useState(false);
  const login = useLogin();
  const session = useCurrentUser();
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" },
  });
  useEffect(() => {
    if (session.status === "authenticated" && session.user) router.replace(roleRoutes[session.user.role]);
  }, [session.status, session.user, router]);
  const disabled = login.isPending || session.status === "loading" || session.status === "authenticated";

  return (
    <div className="space-y-5">
      <form noValidate aria-busy={disabled} onSubmit={handleSubmit(login.login)} className="space-y-5">
        {login.error && <Alert variant="destructive" role="alert"><AlertTitle>We couldn’t sign you in</AlertTitle><AlertDescription>{login.error}</AlertDescription></Alert>}
        {session.status === "error" && <p role="status" className="text-body-md text-muted-foreground">We couldn’t check your current session. You can try signing in again.</p>}
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input id="login-email" type="email" autoComplete="username" required disabled={disabled} aria-invalid={!!errors.email} aria-describedby={errors.email ? "login-email-error" : undefined} className="h-11" {...register("email")} />
          {errors.email && <p id="login-email-error" role="alert" className="text-body-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <div className="relative">
            <Input id="login-password" type={visible ? "text" : "password"} autoComplete="current-password" required disabled={disabled} aria-invalid={!!errors.password} aria-describedby={errors.password ? "login-password-error" : undefined} className="h-11 pr-12" {...register("password")} />
            <Button type="button" variant="ghost" size="icon" className="absolute top-1.5 right-1.5" disabled={disabled} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button>
          </div>
          {errors.password && <p id="login-password-error" role="alert" className="text-body-sm text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" disabled={disabled} className="h-11 w-full gap-2">{disabled ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />{login.isPending ? "Signing in…" : "Checking session…"}</> : <>Sign in<ArrowRight aria-hidden="true" /></>}</Button>
        <p className="text-right text-body-md"><Link href="/forgot-password" className="rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">Forgot password?</Link></p>
        <p role="status" className="sr-only">{disabled ? "Please wait." : ""}</p>
        <p className="border-t pt-5 text-center text-sm text-muted-foreground">New to SURFERTrack? <Link className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4" href="/register">Create an account</Link></p>
      </form>
      {login.unverifiedEmail && <ResendVerificationForm key={login.unverifiedEmail} initialEmail={login.unverifiedEmail} />}
    </div>
  );
}
