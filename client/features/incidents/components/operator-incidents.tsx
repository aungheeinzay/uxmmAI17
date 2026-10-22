"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatParcelDate } from "@/features/operator/format";
import { getOperatorIncidents } from "../api/incidents.api";
import { useIncidentResource } from "../hooks/use-incidents";
import { incidentStatusLabels, type IncidentStatus } from "../types/incident.types";
import { IncidentFeedback, IncidentRequestState, IncidentStatusBadge, IncidentTypeBadge } from "./incident-shared";

type Filter = "ALL" | IncidentStatus;
const filters: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" }, { value: "OPEN", label: incidentStatusLabels.OPEN }, { value: "REVIEWED", label: incidentStatusLabels.REVIEWED },
];
const load = (key: string) => getOperatorIncidents(JSON.parse(key) as { status?: IncidentStatus });

export function OperatorIncidents() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const query = useIncidentResource("OPERATOR", JSON.stringify(filter === "ALL" ? {} : { status: filter }), load);
  const incidents = query.data?.incidents ?? [];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">Operations workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight">Incidents</h1>
        <p className="mt-2 text-muted-foreground">Damaged, broken or lost parcel reports from your delivery provider.</p>
      </div>
      <Button variant="outline" disabled={query.isLoading} onClick={query.retry}><RefreshCw aria-hidden="true" />Refresh incidents</Button>
    </div>
    <IncidentFeedback />
    <div role="tablist" aria-label="Incident review status" className="inline-flex rounded-xl bg-muted p-1">
      {filters.map(item => <button key={item.value} type="button" role="tab" aria-selected={filter === item.value} onClick={() => setFilter(item.value)}
        className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition ${filter === item.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
    </div>
    <IncidentRequestState loading={query.isLoading} error={query.error} retry={query.retry} />
    {!query.isLoading && !query.error && incidents.length === 0 && (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 font-medium">{filter === "ALL" ? "No incidents reported" : `No ${incidentStatusLabels[filter as IncidentStatus].toLowerCase()} incidents`}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Rider reports for your provider appear here.</p>
      </div>
    )}
    <div className="grid gap-4 md:grid-cols-2">
      {incidents.map(incident => <article key={incident.id} className="space-y-3 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold">{incident.order.orderCode}</p>
            <p className="text-sm text-muted-foreground">{incident.order.recipientName} · {incident.order.township}</p>
          </div>
          <div className="flex flex-wrap gap-1.5"><IncidentTypeBadge type={incident.type} /><IncidentStatusBadge status={incident.status} /></div>
        </div>
        <p className="text-sm"><span className="font-medium">Reason:</span> {incident.reason}</p>
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{incident.description}</p>
        <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div><dt>Rider</dt><dd className="mt-0.5 font-medium text-foreground">{incident.rider.fullName ?? "Name unavailable"}</dd></div>
          <div><dt>Reported</dt><dd className="mt-0.5 font-medium text-foreground">{formatParcelDate(incident.createdAt)} MMT</dd></div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <Link href={`/operator/parcels/${incident.order.id}?returnTo=${encodeURIComponent("/operator/incidents")}`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">View parcel</Link>
          <Link href={`/operator/incidents/${incident.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary">Open report <ChevronRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </article>)}
    </div>
  </div>;
}
