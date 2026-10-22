import Link from "next/link";
import { Button } from "@/components/ui/button";
export function ParcelRequestState({ loading, error, retry, loadingMessage = "Loading parcels…" }: { loading?: boolean; error?: string; retry: () => void; loadingMessage?: string }) {
  if (loading) return <div role="status" className="rounded-xl border bg-card p-8 text-sm text-muted-foreground">{loadingMessage}</div>;
  if (error) return <div role="alert" className="space-y-3 rounded-xl border bg-card p-6"><p>{error}</p><div className="flex gap-3"><Button variant="outline" onClick={retry}>Try again</Button>{error.includes("Sign in") && <Link href="/login" className="text-sm underline">Sign in</Link>}</div></div>;
  return null;
}
