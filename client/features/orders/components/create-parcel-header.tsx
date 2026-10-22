"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CreateParcelHeaderProps = {
  className?: string;
};

export function CreateParcelHeader({ className }: CreateParcelHeaderProps) {
  return (
    <header
      className={cn(
        "-mx-4 -mt-6 flex flex-col gap-4 border-b border-border bg-surface px-4 py-6 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Parcels &middot; New shipment
        </p>
        <h1 className="text-heading-1 font-bold tracking-tight text-brand-dark">Create a parcel</h1>
        <p className="text-body-md text-muted-foreground">
          Add a shipment and pick the delivery service that fits its destination.
        </p>
      </div>

      <Button
        asChild
        variant="outline"
        className="h-auto shrink-0 gap-2 rounded-full border-border bg-surface px-5 py-2.5 font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <Link href="/seller">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to parcels
        </Link>
      </Button>
    </header>
  );
}
