"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { updateDelivery } from "../api/deliveries.api";
import { useDeliveryMutation } from "../hooks/use-deliveries";
import { deliveryStatusSchema, riderActions, type AssignmentDetail, type DeliveryStatusInput } from "../types/delivery.types";
import { deliveryNotice } from "./delivery-shared";
const labels = { IN_TRANSIT: "Start delivery", OUT_FOR_DELIVERY: "Mark out for delivery", DELIVERED: "Confirm delivered", FAILED: "Report failed delivery" };
export function DeliveryActions({ assignment }: { assignment: AssignmentDetail }) {
  const [target, setTarget] = useState<DeliveryStatusInput["status"]>();
  const mutation = useDeliveryMutation(updateDelivery);
  const actions = Object.hasOwn(riderActions, assignment.order.status) ? riderActions[assignment.order.status] : [];
  const form = useForm<DeliveryStatusInput>({ resolver: zodResolver(deliveryStatusSchema) });
  return <section className="space-y-4 rounded-2xl border bg-card p-5">
    <div>
      <h2 className="font-semibold">Update delivery status</h2>
      <p className="mt-1 text-sm text-muted-foreground">Only the next approved step is available. The status changes after the backend confirms it.</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {actions.map(status => <Button key={status} disabled={mutation.isPending} variant={status === "FAILED" ? "outline" : "default"} className={status === "FAILED" ? "min-h-11 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive" : "min-h-11"} onClick={() => { form.reset({ status }); setTarget(status); }}>{labels[status]}</Button>)}
    </div>
    {!actions.length && <p className="text-sm text-muted-foreground">No delivery actions are available for this status.</p>}
    <Dialog open={!!target} onOpenChange={open => { if (!open && !mutation.isPending) setTarget(undefined); }}>
      <DialogContent onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault(); }} onInteractOutside={event => { if (mutation.isPending) event.preventDefault(); }}>
        <DialogTitle className="text-lg font-semibold">{target && labels[target]}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Confirm the status change for {assignment.order.orderCode}, recipient {assignment.order.recipientName}.</DialogDescription>
        <form className="space-y-4" onSubmit={form.handleSubmit(async input => {
          const result = await mutation.submit({ id: assignment.id, ...input });
          if (result) { deliveryNotice(`Delivery updated. Current status: ${result.order.status}.`); setTarget(undefined); }
        })}>
          {target === "FAILED" && <div className="space-y-2"><Label htmlFor="failure-note">Failure reason</Label><textarea id="failure-note" rows={3} maxLength={1000} className="w-full rounded-lg border bg-card p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-sm" disabled={mutation.isPending} {...form.register("note")} /><p className="text-xs text-muted-foreground">Required, 3–1000 characters.</p>{form.formState.errors.note && <p role="alert" className="text-sm text-destructive">{form.formState.errors.note.message}</p>}</div>}
          {mutation.error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{mutation.error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={mutation.isPending} className="min-h-11" onClick={() => setTarget(undefined)}>Cancel</Button><Button type="submit" disabled={mutation.isPending} className="min-h-11">{mutation.isPending ? "Updating…" : "Confirm status change"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}
