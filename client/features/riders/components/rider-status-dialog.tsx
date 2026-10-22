"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { deactivateManagedRider, reactivateManagedRider, riderMutationError } from "../api/rider-management.api";
import type { ManagedRider } from "../types/rider-management.types";

export function RiderStatusDialog({ rider, action, onClose, onSaved }: {
  rider: ManagedRider;
  action: "deactivate" | "reactivate";
  onClose: () => void;
  onSaved: (rider: ManagedRider, message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deactivating = action === "deactivate";

  async function confirm() {
    setPending(true); setError(null);
    try {
      const saved = deactivating ? await deactivateManagedRider(rider.id) : await reactivateManagedRider(rider.id);
      onSaved(saved, deactivating ? "Rider deactivated. Existing delivery history was preserved." : "Rider reactivated. They must sign in again; profile completion and delivery requirements still apply.");
    } catch (cause) {
      setError(riderMutationError(cause));
    } finally {
      setPending(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent aria-describedby="rider-status-description">
    <DialogTitle>{deactivating ? "Deactivate this Rider?" : "Reactivate this Rider?"}</DialogTitle>
    <DialogDescription id="rider-status-description">
      {deactivating
        ? "They will no longer receive new assignments or perform delivery actions. Existing delivery history will be preserved."
        : "They must sign in again and will become eligible for new assignments. Profile completion requirements still apply, and no assignment is created automatically."}
    </DialogDescription>
    <p className="text-sm"><span className="font-medium">Rider:</span> {rider.fullName ?? "Unnamed Rider"} · {rider.email ?? "No account email"}</p>
    {rider.activeAssignedTaskCount > 0 && deactivating && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This Rider has {rider.activeAssignedTaskCount} active assignment{rider.activeAssignedTaskCount === 1 ? "" : "s"}. The server will block deactivation until those are resolved or safely reassigned.</p>}
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
      <Button type="button" variant={deactivating ? "destructive" : "default"} disabled={pending} onClick={confirm}>
        {pending ? (deactivating ? "Deactivating Rider..." : "Reactivating Rider...") : (deactivating ? "Deactivate Rider" : "Reactivate Rider")}
      </Button>
    </div>
  </DialogContent></Dialog>;
}
