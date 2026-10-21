import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, QrCode, Inbox } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useParcels, type ParcelStatus } from "@/lib/rider-store";
import { ParcelCard, RiderHeader } from "@/components/rider/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Deliveries — SURFERTrack Rider" },
      { name: "description", content: "Scan parcel QR codes and manage your assigned deliveries." },
      { property: "og:title", content: "My Deliveries — SURFERTrack Rider" },
      { property: "og:description", content: "Scan parcel QR codes and manage your assigned deliveries." },
    ],
  }),
  component: Home,
});

const filters: { key: "all" | ParcelStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "picked_up", label: "Picked Up" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
];

function Home() {
  const parcels = useParcels();
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [filter, setFilter] = useState<"all" | ParcelStatus>("in_transit");

  const active = parcels.filter((p) => p.status !== "delivered" && p.status !== "failed");
  const completed = parcels.filter((p) => p.status === "delivered" || p.status === "failed");
  const list = tab === "completed" ? completed : filter === "all" ? active : active.filter((p) => p.status === filter);

  return (
    <div className="min-h-screen bg-[#e4f2ff] pb-5">
      <RiderHeader>
        <Link
          to="/scan"
          aria-label="Scan Parcel QR Code"
          className="group relative mt-7 flex min-h-[108px] items-center gap-4 overflow-hidden rounded-[24px] border border-white/45 bg-gradient-to-br from-[#b9ddff] via-[#b2d6ff] to-[#81b8ff] px-5 py-4 shadow-[0_10px_24px_rgba(0,49,133,0.14)] transition-transform active:scale-[0.99]"
        >
          {/* Soft faceted highlight from the supplied reference. */}
          <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rotate-45 bg-gradient-to-b from-white/45 via-white/10 to-transparent [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
          <div aria-hidden="true" className="pointer-events-none absolute right-0 bottom-0 h-20 w-28 bg-white/10 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
          <div className="relative grid h-[76px] w-[78px] shrink-0 place-items-center rounded-[19px] bg-gradient-to-br from-white/95 to-[#edf6ff] shadow-[0_4px_14px_rgba(29,105,204,0.08)] max-[370px]:h-[74px] max-[370px]:w-[78px]">
            <QrCode className="h-[55px] w-[55px] text-[#0875e8] max-[370px]:h-12 max-[370px]:w-12" strokeWidth={2.2} />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-[clamp(15px,4vw,20px)] font-bold leading-tight tracking-tight text-[#07153d]">Scan Parcel QR Code</p>
            <p className="mt-2 text-[clamp(11px,3vw,15px)] leading-snug text-[#526681]">Scan each parcel to pick it up</p>
          </div>
          <div className="relative grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-white/95 to-[#d6eaff] shadow-[0_5px_15px_rgba(35,92,171,0.10)] max-[370px]:h-12 max-[370px]:w-12">
            <ChevronRight className="h-8 w-8 text-[#071744]" strokeWidth={3} />
          </div>
        </Link>
      </RiderHeader>

      <div className="-mt-2 rounded-t-[28px] bg-[#e4f2ff]">
        <div className="flex rounded-t-[28px] border-b border-border bg-white px-4">
          {(["active", "completed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 border-b-2 py-3 text-sm font-medium", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
            >
              {t === "active" ? "My Deliveries" : `Completed (${completed.length})`}
            </button>
          ))}
        </div>

        {tab === "active" && (
          <div className="grid grid-cols-4 gap-1.5 px-3 py-3">
            {filters.map((f) => {
              const count = f.key === "all" ? active.length : active.filter((p) => p.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "min-w-0 whitespace-nowrap rounded-lg border px-1 py-2 text-[clamp(8px,2.5vw,12px)] font-medium",
                    filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {list.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Inbox className="h-10 w-10" />
            <p className="mt-2 text-sm">No parcels here</p>
          </div>
        ) : (
          <div className="space-y-3 px-3 pb-5">{list.map((p) => <ParcelCard key={p.id} p={p} />)}</div>
        )}
      </div>
    </div>
  );
}
