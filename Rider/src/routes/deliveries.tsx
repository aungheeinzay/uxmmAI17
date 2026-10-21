import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMMK, useParcels, type Parcel } from "@/lib/rider-store";
import { ParcelCard } from "@/components/rider/ui";

export const Route = createFileRoute("/deliveries")({
  head: () => ({
    meta: [
      { title: "Today's Deliveries — SURFERTrack Rider" },
      { name: "description", content: "Assigned, in-transit, delivered and failed parcels for today." },
      { property: "og:title", content: "Today's Deliveries — SURFERTrack Rider" },
      { property: "og:description", content: "Assigned, in-transit, delivered and failed parcels for today." },
    ],
  }),
  component: Deliveries,
});

const tabs: { key: string; label: string; match: (p: Parcel) => boolean }[] = [
  { key: "assigned", label: "Assigned", match: (p) => p.status === "pending" || p.status === "picked_up" },
  { key: "transit", label: "In Transit", match: (p) => p.status === "in_transit" || p.status === "out_for_delivery" },
  { key: "delivered", label: "Delivered", match: (p) => p.status === "delivered" },
  { key: "failed", label: "Failed / Returned", match: (p) => p.status === "failed" },
];

function Deliveries() {
  const parcels = useParcels();
  const [tab, setTab] = useState("assigned");
  const current = tabs.find((t) => t.key === tab)!;
  const list = parcels.filter(current.match);
  const codDue = parcels.filter((p) => p.status !== "delivered" && p.status !== "failed").reduce((s, p) => s + p.codAmount, 0);

  return (
    <div className="min-h-screen pb-5">
      <header className="bg-header px-5 pb-5 pt-6 text-primary-foreground">
        <h1 className="text-2xl font-bold">Today's Deliveries</h1>
        <p className="text-sm opacity-80">{parcels.length} parcels assigned</p>
        <div className="mt-4 rounded-2xl bg-primary-foreground/15 p-4">
          <p className="text-xs opacity-80">COD still to collect</p>
          <p className="text-2xl font-bold">{formatMMK(codDue)}</p>
        </div>
      </header>
      <div className="grid grid-cols-4 gap-1 px-2 py-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "min-w-0 rounded-lg border px-1 py-2 text-[clamp(8px,2.5vw,12px)] font-medium",
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground",
            )}
          >
            {t.label} ({parcels.filter(t.match).length})
          </button>
        ))}
      </div>
      <div className="bg-card">
        {list.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Inbox className="h-10 w-10" />
            <p className="mt-2 text-sm">Nothing in this list</p>
          </div>
        ) : (
          list.map((p) => <ParcelCard key={p.id} p={p} />)
        )}
      </div>
    </div>
  );
}
