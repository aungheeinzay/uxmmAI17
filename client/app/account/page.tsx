import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountPanel } from "@/features/auth/components/account-panel";

export const metadata: Metadata = { title: "Your account | SURFERTrack", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-12"><Card className="w-full max-w-md"><CardHeader><CardTitle className="text-2xl">Your SURFERTrack account</CardTitle></CardHeader><CardContent><AccountPanel /></CardContent></Card></main>;
}
