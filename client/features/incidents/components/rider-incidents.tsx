"use client";
import Link from "next/link";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatParcelDate } from "@/features/operator/format";
import { getMyIncidents } from "../api/incidents.api";
import { useIncidentResource } from "../hooks/use-incidents";
import { IncidentFeedback, IncidentRequestState, IncidentStatusBadge, IncidentTypeBadge } from "./incident-shared";

const load = () => getMyIncidents({ page: 1, pageSize: 100 });

export function RiderIncidents() {
  const query = useIncidentResource("RIDER", "mine", load);
  const incidents = query.data?.incidents ?? [];
  return <div className="space-y-4">
    <Link href="/rider" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ChevronLeft aria-hidden="true" className="size-4" />Back to my deliveries</Link>
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Incidents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Problems you reported for your assigned parcels.</p>
      </div>
      <Button variant="outline" size="sm" className="min-h-10" disabled={query.isLoading} onClick={query.retry}><RefreshCw aria-hidden="true" />Refresh</Button>
    </div>
    <IncidentFeedback />
    <IncidentRequestState loading={query.isLoading} error={query.error} retry={query.retry} />
    {!query.isLoading && !query.error && incidents.length === 0 && (
      <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
        <p className="font-medium">No incidents reported</p>
        <p className="mt-1 text-sm text-muted-foreground">Open an assigned parcel and choose Report Incident if something is wrong.</p>
      </div>
    )}
    <div className="space-y-3">
      {incidents.map(incident => <article key={incident.id} className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold">{incident.order.orderCode}</p>
            <p className="text-sm text-muted-foreground">{incident.order.recipientName} · {incident.order.township}</p>
          </div>
          <div className="flex flex-wrap gap-1.5"><IncidentTypeBadge type={incident.type} /><IncidentStatusBadge status={incident.status} /></div>
        </div>
        <p className="text-sm"><span className="font-medium">Reason:</span> {incident.reason}</p>
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{incident.description}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>Reported {formatParcelDate(incident.createdAt)} MMT</span>
          {incident.assignmentId && <Link href={`/rider/assignments/${incident.assignmentId}`} className="font-medium text-primary underline-offset-4 hover:underline">View delivery</Link>}
        </div>
      </article>)}
    </div>
  </div>;
}
