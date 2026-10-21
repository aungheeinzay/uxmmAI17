import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RiderActivationForm } from "@/features/auth/components/rider-activation-form";

export const metadata: Metadata = { title: "Activate Rider | ParcelOps AI", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ActivateRiderPage() {
  return <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12"><Card className="w-full max-w-md"><CardHeader className="space-y-2"><CardTitle className="text-2xl">Activate your Rider account</CardTitle><CardDescription>Choose a password, then sign in. Invitations expire after 24 hours.</CardDescription></CardHeader><CardContent><RiderActivationForm /></CardContent></Card></main>;
}
