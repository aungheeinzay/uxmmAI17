import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime, useParcels } from "@/lib/rider-store";
import { InfoTile, PageHeader, ParcelDetailsCard, SuccessIndicator } from "@/components/rider/ui";

export const Route = createFileRoute("/pickup-success/$id")({
  head: () => ({
    meta: [
      { title: "Pickup Successful — SURFERTrack Rider" },
      { name: "description", content: "The parcel has been picked up." },
      { property: "og:title", content: "Pickup Successful — SURFERTrack Rider" },
      { property: "og:description", content: "The parcel has been picked up." },
    ],
  }),
  component: PickupSuccess,
});

function PickupSuccess() {
  const { id } = Route.useParams();
  const parcel = useParcels().find((p) => p.id === id);
  return (
    <div className="min-h-screen bg-[linear-gradient(155deg,#fff_15%,#f0f9ff_65%,#fff_100%)] pb-8">
      <PageHeader title="Parcel Scanned" />
      <div className="mx-auto max-w-md space-y-5 px-5">
        <SuccessIndicator title="Pickup Successful" subtitle="Parcel has been picked up" />
        {parcel && <ParcelDetailsCard p={parcel} />}
        <InfoTile icon={<Clock className="h-6 w-6" />} label="Picked up at" value={formatDateTime(parcel?.pickedUpAt)} />
        <div className="space-y-3 pt-2">
          <Button asChild className="h-14 w-full rounded-2xl bg-[#0865f5] text-base font-bold text-white hover:bg-[#0755d0]">
            <Link to="/scan">Scan Another Parcel</Link>
          </Button>
          <Button asChild variant="outline" className="h-14 w-full rounded-2xl border-[#0865f5] text-base font-bold text-[#0865f5]">
            <Link to="/">View My Deliveries</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
