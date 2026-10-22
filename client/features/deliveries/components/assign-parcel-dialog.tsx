"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { assignParcel, getEligibleRiders } from "../api/deliveries.api";
import { createAssignmentSchema, type DeliveryQuery } from "../types/delivery.types";
import { useDeliveryMutation, useDeliveryResource } from "../hooks/use-deliveries";
import { DeliveryRequestState, DeliveryPagination, deliveryNotice } from "./delivery-shared";
import { ApiError } from "@/lib/api-client";
const loadRiders = (key: string) => getEligibleRiders(JSON.parse(key) as DeliveryQuery);
export function AssignParcelDialog({ order }: { order: { id: string; orderCode: string; recipientName: string } }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogTrigger asChild><Button>Assign Rider</Button></DialogTrigger>
    <DialogContent onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onInteractOutside={event => { if (pending) event.preventDefault(); }}>
      <DialogTitle className="text-lg font-semibold">Assign a Rider</DialogTitle><DialogDescription className="text-sm text-muted-foreground">{order.orderCode} · {order.recipientName}. Confirm a Rider for this received parcel. Status stays PICKED_UP. Reassignment is unavailable.</DialogDescription>
      {open && <AssignmentForm orderId={order.id} pending={setPending} close={() => setOpen(false)} />}
    </DialogContent></Dialog>;
}
function AssignmentForm({ orderId, pending, close }: { orderId: string; pending: (value: boolean) => void; close: () => void }) {
  const [page, setPage] = useState(1);
  const riders = useDeliveryResource("OPERATOR", JSON.stringify({ page, pageSize: 20 }), loadRiders);
  const form = useForm<{ orderId: string; riderId: string }>({ resolver: zodResolver(createAssignmentSchema), defaultValues: { orderId, riderId: "" } });
  function refreshRiders() {
    form.resetField("riderId");
    if (page !== 1) setPage(1);
    else riders.retry();
  }
  const mutation = useDeliveryMutation(assignParcel, error => {
    if (error instanceof ApiError && error.status === 404 && error.code === "RIDER_NOT_ELIGIBLE") refreshRiders();
  });
  const selected = useWatch({ control: form.control, name: "riderId" });
  const hasRiders = !!riders.data?.riders.length;
  const selectedEligible = riders.data?.riders.some(rider => rider.id === selected) ?? false;
  async function submit(input: { orderId: string; riderId: string }) {
    if (riders.isLoading || riders.error || !hasRiders || mutation.isPending) return;
    if (!selectedEligible) { form.setError("riderId", { type: "validate", message: "Please select a rider" }); return; }
    pending(true);
    try {
      const result = await mutation.submit(input);
      if (result) { deliveryNotice(`Rider assigned to ${result.order.orderCode}. Current status: ${result.order.status}.`); close(); }
    } finally { pending(false); }
  }
  return <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
    <DeliveryRequestState loading={riders.isLoading} error={riders.error} retry={refreshRiders} />
    {riders.data && <>{hasRiders ? <><Label htmlFor={`rider-${orderId}`}>Eligible Rider</Label><select id={`rider-${orderId}`} className="w-full rounded-lg border bg-background p-2" disabled={mutation.isPending} {...form.register("riderId")}><option value="">Select a Rider</option>{riders.data.riders.map(rider => <option key={rider.id} value={rider.id}>{rider.fullName ?? "Name unavailable"} · {rider.phone ?? rider.id}</option>)}</select>
      {!selectedEligible && !form.formState.errors.riderId && <p className="text-sm text-muted-foreground">Please select a rider</p>}</> : riders.data.pagination.total === 0 ? <div role="status" className="space-y-2 rounded-lg border border-dashed p-4"><p className="font-medium">No riders available for assignment</p><p className="text-sm text-muted-foreground">No eligible riders were found. This parcel remains unassigned with status PICKED_UP. Refresh Riders or invite and activate a Rider to assign it later.</p><Link href="/operator/riders" className="inline-block text-sm underline">Rider Management</Link></div> : <p>No eligible riders on this page. Return to an earlier page or refresh Riders.</p>}
      <fieldset disabled={mutation.isPending}><DeliveryPagination {...riders.data.pagination} onPage={value => { form.resetField("riderId"); setPage(value); }} /></fieldset></>}
    <Button type="button" variant="outline" disabled={riders.isLoading || mutation.isPending} onClick={refreshRiders}>Refresh Riders</Button>
    {form.formState.errors.riderId && <p role="alert">Please select a rider</p>}
    {mutation.error && <p role="alert">{mutation.error}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending || !riders.data?.riders.length}>{mutation.isPending ? "Assigning…" : "Confirm assignment"}</Button></div>
  </form>;
}
