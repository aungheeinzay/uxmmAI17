import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/features/auth/components/register-form";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Create your account | SURFERTrack",
  description: "Register your SME account with SURFERTrack.",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10 sm:px-8">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <section className="space-y-6">
          <Image src="/images/logo.png" alt="SURFERTrack" width={1280} height={295} sizes="224px" className="h-auto w-full" />
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Built for growing businesses</p>
          <h1 className="max-w-md text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">Your next delivery starts here.</h1>
          <p className="max-w-sm text-base leading-relaxed text-muted-foreground">Create your SME account and take the first step toward simpler parcel operations.</p>
          <ul className="space-y-3 text-sm text-muted-foreground">
            {["A dedicated account for your business", "Secure email verification", "A simple start for your team"].map((text) => <li key={text} className="flex items-center gap-2"><Check className="size-4 text-foreground" aria-hidden="true" />{text}</li>)}
          </ul>
        </section>
        <Card className="w-full shadow-sm">
          <CardHeader className="space-y-2 p-6 sm:p-8">
            <CardTitle className="text-2xl tracking-tight">Create your account</CardTitle>
            <CardDescription>Enter your details. We’ll email you a verification link.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8"><RegisterForm /></CardContent>
        </Card>
      </div>
    </main>
  );
}
