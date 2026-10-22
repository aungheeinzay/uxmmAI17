import Link from "next/link";
import { ArrowRight, Boxes, ScanLine, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const highlights = [
  {
    icon: Boxes,
    title: "One parcel ledger",
    description: "Every shipment, status change and delivery attempt in a single live view for your whole team.",
  },
  {
    icon: Truck,
    title: "Fleet coordination",
    description: "Operators invite riders, hand over parcels and follow each handover down to the doorstep.",
  },
  {
    icon: ScanLine,
    title: "Scan once, stay informed",
    description: "Every parcel carries a QR code so pick-up and delivery events are recorded against the right order.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-primary-foreground shadow-sm">
            <Truck aria-hidden="true" className="size-5" />
          </span>
          <span className="text-heading-3 font-bold tracking-tight text-foreground">
            SURFER<span className="text-brand">Track</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Create account
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-body-sm font-semibold uppercase tracking-[0.08em] text-brand">Parcel operations</p>
          <h1 className="mt-3 text-display-lg font-bold tracking-tight text-foreground sm:text-heading-1">
            Every parcel, every handoff, one live view.
          </h1>
          <p className="mt-4 text-body-lg text-muted-foreground">
            SURFERTrack keeps sellers, operators and riders aligned on the same delivery network — from the moment a
            parcel is created to the moment it is delivered.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 gap-2 px-5">
              <Link href="/register">
                Create your workspace
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-11 px-5">
              <Link href="/login">Sign in to your workspace</Link>
            </Button>
          </div>
        </div>

        <section aria-labelledby="highlights-title" className="mt-16 space-y-6">
          <h2 id="highlights-title" className="text-heading-2 font-bold tracking-tight text-foreground">
            Built for the whole delivery chain
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="transition-shadow hover:shadow-card-hover">
                <CardHeader>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <CardTitle className="text-heading-3 font-semibold">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-body-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>SURFERTrack — parcel operations for sellers, operators and riders.</p>
          <p>Sellers · Operators · Riders</p>
        </div>
      </footer>
    </div>
  );
}
