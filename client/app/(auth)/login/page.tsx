import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import Image from "next/image";

export const metadata: Metadata = { title: "Sign in | SURFERTrack", description: "Sign in to your SURFERTrack account." };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10 sm:px-8">
      <div className="w-full max-w-md space-y-6">
        <Image src="/images/logo.png" alt="SURFERTrack" width={1280} height={295} sizes="224px" className="h-auto w-full" />
        <Card className="shadow-sm"><CardHeader className="space-y-2 p-6 sm:p-8"><CardTitle className="text-2xl tracking-tight">Welcome back</CardTitle><CardDescription>Sign in to your verified account.</CardDescription></CardHeader><CardContent className="px-6 pb-6 sm:px-8 sm:pb-8"><LoginForm /></CardContent></Card>
      </div>
    </main>
  );
}
