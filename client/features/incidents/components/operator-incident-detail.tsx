"use client";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatParcelDate } from "@/features/operator/format";
import { parcelStatusLabel } from "@/features/operator/components/parcel-status-badge";
import { getOperatorIncident, reviewIncident } from "../api/incidents.api";
import { useIncidentMutation, useIncidentResource } from "../hooks/use-incidents";
import { incidentNotice, IncidentFeedback, IncidentRequestState, IncidentStatusBadge, IncidentTypeBadge } from "./incident-shared";

const load = (key: string) => getOperatorIncident(key);

export function OperatorIncidentDetail({ id }: { id: string }) {
  const query = useIncidentResource("OPERATOR", id, load);
  const mutation = useIncidentMutation(reviewIncident);
  const incident = query.data;

  async function review() {
    if (!incident) return;
    const result = await mutation.submit({ id: incident.id, status: "REVIEWED" });
    if (result) { incidentNotice(result.status === "REVIEWED" ? "Incident marked as reviewed." : "Incident updated."); query.retry(); }
  }

  return <div className="space-y-4">
    <Link href="/operator/incidents" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ChevronLeft aria-hidden="true" className="size-4" />Back to incidents
    </Link>
    <IncidentFeedback />
    <IncidentRequestState loading={query.isLoading} error={query.error} retry={query.retry} />
    {incident && <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Incident report</p>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{incident.order.orderCode}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Reported {formatParcelDate(incident.createdAt)} MMT</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IncidentTypeBadge type={incident.type} />
          <IncidentStatusBadge status={incident.status} />
        </div>
      </div>
      <Button variant="outline" disabled={query.isLoading || mutation.isPending} onClick={query.retry}><RefreshCw aria-hidden="true" />Refresh incident</Button>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="font-semibold">{incident.reason}</h2>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{incident.description}</p>
          </div>
        </div>
        <dl className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Rider</dt><dd className="mt-1 text-sm font-medium">{incident.rider.fullName ?? "Name unavailable"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Rider phone</dt><dd className="mt-1 text-sm font-medium">{incident.rider.phone ?? "Not provided"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Recipient</dt><dd className="mt-1 text-sm font-medium">{incident.order.recipientName}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Township</dt><dd className="mt-1 text-sm font-medium">{incident.order.township}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Delivery address</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{incident.order.deliveryAddress}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Order status</dt><dd className="mt-1 text-sm font-medium">{parcelStatusLabel(incident.order.status)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Reviewed</dt><dd className="mt-1 text-sm font-medium">{incident.reviewedAt ? `${formatParcelDate(incident.reviewedAt)} MMT by ${incident.reviewedBy?.fullName ?? "Unavailable"}` : "Not yet reviewed"}</dd></div>
        </dl>
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">Reporting an incident never changed this parcel&apos;s order status. Photo evidence is not collected in this phase because no approved upload storage is configured.</p>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Review</h2>
        <p className="mt-1 text-sm text-muted-foreground">Confirm that your delivery provider has reviewed this report. Reviewing does not change the parcel status and does not delete the report.</p>
        {incident.status === "REVIEWED"
          ? <p className="mt-4 rounded-lg border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-900">This incident was reviewed{incident.reviewedAt ? ` on ${formatParcelDate(incident.reviewedAt)} MMT` : ""}.</p>
          : <Button className="mt-4 min-h-11" disabled={mutation.isPending} onClick={review}>{mutation.isPending ? "Saving…" : "Mark as reviewed"}</Button>}
        {mutation.error && <p role="alert" className="mt-3 text-sm text-destructive">{mutation.error}</p>}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href={`/operator/parcels/${incident.order.id}?returnTo=${encodeURIComponent(`/operator/incidents/${incident.id}`)}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">View parcel details</Link>
      </div>
    </>}
  </div>;
}
