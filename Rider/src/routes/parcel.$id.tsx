import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MapPin, Phone, Store, StickyNote, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FAILURE_REASONS, formatMMK, riderApi, useParcels, type FailureCode } from "@/lib/rider-store";
import { InfoTile, PageHeader, ParcelDetailsCard, SuccessIndicator } from "@/components/rider/ui";

export const Route = createFileRoute("/parcel/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Parcel ${params.id} — SURFERTrack Rider` },
      { name: "description", content: "Parcel details, pickup and delivery actions." },
      { property: "og:title", content: `Parcel ${params.id} — SURFERTrack Rider` },
      { property: "og:description", content: "Parcel details, pickup and delivery actions." },
    ],
  }),
  component: ParcelPage,
});

const btn = "h-14 w-full rounded-2xl text-base font-bold";

function ParcelPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const parcel = useParcels().find((p) => p.id === id);
  const [busy, setBusy] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [cash, setCash] = useState("");
  const [reason, setReason] = useState<FailureCode | null>(null);

  if (!parcel) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Parcel" />
        <p className="p-8 text-center text-muted-foreground">Parcel not found.</p>
      </div>
    );
  }

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const isPickup = parcel.status === "pending";
  const done = parcel.status === "delivered" || parcel.status === "failed";

  return (
    <div className="min-h-screen bg-[linear-gradient(155deg,#fff_15%,#f0f9ff_65%,#fff_100%)] pb-8">
      <PageHeader title={isPickup ? "Parcel Scanned" : "Parcel Details"} />
      <div className="mx-auto max-w-md space-y-5 px-5">
        {isPickup && <SuccessIndicator title="Parcel Found" />}
        <ParcelDetailsCard p={parcel} />
        <InfoTile icon={<Store className="h-6 w-6" />} label="Sender" value={parcel.shop} sub={parcel.shopLocation} />

        {!isPickup && (
          <>
            <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <Row icon={<MapPin className="h-4 w-4" />} text={parcel.address} />
              {parcel.notes && <Row icon={<StickyNote className="h-4 w-4" />} text={parcel.notes} />}
              <a href={`tel:${parcel.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 text-sm font-medium text-primary">
                <Phone className="h-4 w-4" /> Call {parcel.recipient} · {parcel.phone}
              </a>
            </div>
            <div className={cn("flex items-center justify-between rounded-2xl p-4", parcel.codAmount ? "bg-danger-soft" : "bg-muted")}>
              <div className="flex items-center gap-3">
                <Wallet className={cn("h-6 w-6", parcel.codAmount ? "text-destructive" : "text-muted-foreground")} />
                <span className="text-sm font-medium">{parcel.codAmount ? "Cash on Delivery" : "Prepaid"}</span>
              </div>
              <span className={cn("text-xl font-bold", parcel.codAmount ? "text-destructive" : "text-muted-foreground")}>
                {formatMMK(parcel.codAmount)}
              </span>
            </div>
            {parcel.status === "failed" && (
              <p className="rounded-xl bg-danger-soft p-3 text-sm text-destructive">
                Failed: {FAILURE_REASONS.find((r) => r.code === parcel.failureCode)?.label}. Return this parcel to the hub.
              </p>
            )}
          </>
        )}

        <div className="space-y-3 pt-2">
          {isPickup && (
            <>
              <Button
                className={cn(btn, "bg-[#0865f5] text-white hover:bg-[#0755d0]")}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await riderApi.confirmPickup(parcel.id);
                    navigate({ to: "/pickup-success/$id", params: { id: parcel.id } });
                  } catch {
                    toast.error("Pickup failed. Try again.");
                    setBusy(false);
                  }
                }}
              >
                {busy && <Loader2 className="animate-spin" />} Confirm Pickup
              </Button>
              <Button asChild variant="outline" className={cn(btn, "border-primary text-primary")}>
                <Link to="/scan">Scan Another Parcel</Link>
              </Button>
            </>
          )}
          {(parcel.status === "picked_up" || parcel.status === "in_transit") && (
            <Button
              className={btn}
              disabled={busy}
              onClick={() =>
                run(
                  () => riderApi.advance(parcel.id, parcel.status === "picked_up" ? "in_transit" : "out_for_delivery"),
                  "Status updated",
                )
              }
            >
              {parcel.status === "picked_up" ? "Start Transit" : "Out for Delivery"}
            </Button>
          )}
          {!isPickup && !done && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className={cn(btn, "border-destructive text-destructive")} onClick={() => setFailOpen(true)}>
                Mark Failed
              </Button>
              <Button className={cn(btn, "bg-success hover:bg-success/90")} onClick={() => { setCash(""); setDeliverOpen(true); }}>
                Mark Delivered
              </Button>
            </div>
          )}
          {done && (
            <Button asChild variant="outline" className={cn(btn, "border-primary text-primary")}>
              <Link to="/">Back to My Deliveries</Link>
            </Button>
          )}
        </div>
      </div>

      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm delivery</DialogTitle>
          </DialogHeader>
          {parcel.codAmount > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Collect exactly <b className="text-destructive">{formatMMK(parcel.codAmount)}</b> from {parcel.recipient}.
              </p>
              <input
                inputMode="numeric"
                value={cash}
                onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
                placeholder="Cash collected (Ks)"
                className="w-full rounded-xl border border-input px-4 py-3 outline-none focus:border-primary"
              />
              {cash && Number(cash) !== parcel.codAmount && <p className="text-xs text-destructive">Amount must match the COD amount.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Confirm you handed the parcel to {parcel.recipient}.</p>
          )}
          <Button
            className={cn(btn, "bg-success hover:bg-success/90")}
            disabled={busy || (parcel.codAmount > 0 && Number(cash) !== parcel.codAmount)}
            onClick={() => run(() => riderApi.markDelivered(parcel.id, parcel.codAmount), "Marked as delivered").then(() => setDeliverOpen(false))}
          >
            {busy && <Loader2 className="animate-spin" />} Confirm Delivered
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={failOpen} onOpenChange={setFailOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Why did delivery fail?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {FAILURE_REASONS.map((r) => (
              <button
                key={r.code}
                onClick={() => setReason(r.code)}
                className={cn("w-full rounded-xl border px-4 py-3 text-left text-sm font-medium", reason === r.code ? "border-destructive bg-danger-soft text-destructive" : "border-border")}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button
            variant="destructive"
            className={btn}
            disabled={!reason || busy}
            onClick={() => reason && run(() => riderApi.markFailed(parcel.id, reason), "Moved to Pending Return").then(() => setFailOpen(false))}
          >
            {busy && <Loader2 className="animate-spin" />} Submit
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <p className="flex items-start gap-3 text-sm text-foreground">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      {text}
    </p>
  );
}
