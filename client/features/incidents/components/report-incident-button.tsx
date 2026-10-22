"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AssignmentDetail } from "@/features/deliveries/types/delivery.types";
import { reportIncident } from "../api/incidents.api";
import { useIncidentMutation } from "../hooks/use-incidents";
import { incidentTypeLabels, incidentTypes, reportIncidentSchema, type ReportIncidentValues } from "../types/incident.types";
import { incidentNotice } from "./incident-shared";

const textareaClass = "w-full rounded-lg border bg-card p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-sm";

export function ReportIncidentButton({ assignment }: { assignment: AssignmentDetail }) {
  const [open, setOpen] = useState(false);
  const mutation = useIncidentMutation(reportIncident);
  const form = useForm<ReportIncidentValues>({
    resolver: zodResolver(reportIncidentSchema),
    defaultValues: { assignmentId: assignment.id, type: "DAMAGED", reason: "", description: "" },
  });
  const errors = form.formState.errors;

  function change(open: boolean) {
    if (!open && mutation.isPending) return;
    if (open) form.reset({ assignmentId: assignment.id, type: "DAMAGED", reason: "", description: "" });
    setOpen(open);
  }

  return <>
    <section className="space-y-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"><AlertTriangle aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="font-semibold text-amber-950">Parcel problem?</h2>
          <p className="mt-1 text-sm text-amber-900">Report a damaged, broken or lost parcel so your Operator can review it. Reporting does not change the delivery status.</p>
        </div>
      </div>
      <Button type="button" variant="outline" className="min-h-11 w-full border-amber-400 bg-card text-amber-950 hover:bg-amber-100" onClick={() => change(true)}>
        <AlertTriangle aria-hidden="true" />Report Incident
      </Button>
      {assignment.order.hasIncident && <p className="text-xs font-medium text-amber-900">An incident has already been reported for this parcel. You can still report a different problem type.</p>}
    </section>

    <Dialog open={open} onOpenChange={change}>
      <DialogContent onEscapeKeyDown={event => { if (mutation.isPending) event.preventDefault(); }} onInteractOutside={event => { if (mutation.isPending) event.preventDefault(); }}>
        <DialogTitle className="text-lg font-semibold">Report an incident</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">For {assignment.order.orderCode}, recipient {assignment.order.recipientName}. The order, Rider and provider are recorded by the server.</DialogDescription>
        <form className="space-y-4" noValidate onSubmit={form.handleSubmit(async input => {
          const result = await mutation.submit(input);
          if (result) { incidentNotice("Incident reported. Your Operator will review it."); setOpen(false); }
        })}>
          <div className="space-y-2">
            <Label htmlFor="incident-type">Incident type</Label>
            <select id="incident-type" disabled={mutation.isPending} className="h-11 w-full rounded-lg border border-input bg-card px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-sm" {...form.register("type")}>
              {incidentTypes.map(type => <option key={type} value={type}>{incidentTypeLabels[type]}</option>)}
            </select>
            {errors.type && <p role="alert" className="text-sm text-destructive">{errors.type.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="incident-reason">Reason</Label>
            <input id="incident-reason" maxLength={200} disabled={mutation.isPending} aria-invalid={!!errors.reason} className="h-11 w-full rounded-lg border border-input bg-card px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-sm" placeholder="e.g. Outer carton crushed" {...form.register("reason")} />
            {errors.reason && <p role="alert" className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="incident-description">Short description</Label>
            <textarea id="incident-description" rows={3} maxLength={1000} disabled={mutation.isPending} aria-invalid={!!errors.description} className={textareaClass} placeholder="Describe what you observed. Do not include customer secrets." {...form.register("description")} />
            {errors.description && <p role="alert" className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><Camera aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Photo evidence is not available in this phase because no approved upload storage is configured. The report is still saved without a photo.</p>
          {mutation.error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{mutation.error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={mutation.isPending} className="min-h-11" onClick={() => change(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} className="min-h-11">{mutation.isPending ? "Reporting…" : "Submit incident"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
