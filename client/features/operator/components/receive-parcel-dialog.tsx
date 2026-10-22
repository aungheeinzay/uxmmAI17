"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useReceiveParcel } from "../hooks/use-receive-parcel";
import type { OperatorOrder } from "../types/operator-order.types";
import { parcelStatusLabel } from "./parcel-status-badge";

export function ReceiveParcelDialog({ order }: { order: OperatorOrder }) {
  const [open, setOpen] = useState(false);
  const mutation = useReceiveParcel();
  if (order.status !== "CREATED") return null;
  return <div className="space-y-2"><Dialog open={open} onOpenChange={value => { if (!mutation.isPending) setOpen(value); }}>
    <DialogTrigger asChild><Button disabled={mutation.isPending}>Confirm Received</Button></DialogTrigger>
    <DialogContent onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault(); }} onInteractOutside={event => { if (mutation.isPending) event.preventDefault(); }}>
      <DialogTitle className="text-lg font-semibold">Confirm parcel receipt</DialogTitle>
      <DialogDescription className="text-sm text-muted-foreground">Confirm physical receipt of {order.orderCode} for {order.recipientName}. This parcel will be marked as received into delivery operations.</DialogDescription>
      {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={mutation.isPending} onClick={async () => { if (await mutation.receive(order.id)) setOpen(false); }}>{mutation.isPending ? "Receiving…" : "Confirm receipt"}</Button></div>
    </DialogContent>
  </Dialog>{mutation.data && <p role="status" className="text-sm">Receipt confirmed. Current status: {parcelStatusLabel(mutation.data.status)}.</p>}</div>;
}
