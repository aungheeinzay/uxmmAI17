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
  return <div className="space-y-4"><div className="flex flex-wrap gap-3">{actions.map(status => <Button key={status} disabled={mutation.isPending} variant={status === "FAILED" ? "outline" : "default"} onClick={() => { form.reset({ status }); setTarget(status); }}>{labels[status]}</Button>)}</div>
    {!actions.length && <p className="text-sm text-muted-foreground">No delivery actions are available for this status.</p>}
    <Dialog open={!!target} onOpenChange={open => { if (!open && !mutation.isPending) setTarget(undefined); }}>
      <DialogContent onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault(); }} onInteractOutside={event => { if (mutation.isPending) event.preventDefault(); }}>
        <DialogTitle className="text-lg font-semibold">{target && labels[target]}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Confirm the status change for {assignment.order.orderCode}, recipient {assignment.order.recipientName}.</DialogDescription>
        <form className="space-y-4" onSubmit={form.handleSubmit(async input => {
          const result = await mutation.submit({ id: assignment.id, ...input });
          if (result) { deliveryNotice(`Delivery updated. Current status: ${result.order.status}.`); setTarget(undefined); }
        })}>
          {target === "FAILED" && <div className="space-y-2"><Label htmlFor="failure-note">Failure reason</Label><textarea id="failure-note" rows={3} maxLength={1000} className="w-full rounded-lg border bg-background p-2 text-sm" disabled={mutation.isPending} {...form.register("note")} /><p className="text-xs text-muted-foreground">Required, 3–1000 characters.</p>{form.formState.errors.note && <p role="alert">{form.formState.errors.note.message}</p>}</div>}
          {mutation.error && <p role="alert">{mutation.error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setTarget(undefined)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Updating…" : "Confirm status change"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
