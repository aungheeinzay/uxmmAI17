import type { Metadata } from "next";
import { Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Sign in | ParcelOps AI", description: "Sign in to your ParcelOps AI account." };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10 sm:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3 text-lg font-semibold tracking-tight"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Package aria-hidden="true" className="size-6" /></span>ParcelOps AI</div>
        <Card className="shadow-sm"><CardHeader className="space-y-2 p-6 sm:p-8"><CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle><CardDescription>Sign in to your verified account.</CardDescription></CardHeader><CardContent className="px-6 pb-6 sm:px-8 sm:pb-8"><LoginForm /></CardContent></Card>
      </div>
    </main>
  );
}
