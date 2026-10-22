"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { incidentStatusLabels, incidentTypeLabels, type Incident, type IncidentStatus, type IncidentType } from "../types/incident.types";

export function IncidentFeedback() {
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>();
  useEffect(() => {
    const show = (event: Event) => setFeedback((event as CustomEvent<{ message: string; error?: boolean }>).detail);
    window.addEventListener("incident-feedback", show);
    return () => window.removeEventListener("incident-feedback", show);
  }, []);
  return feedback ? <p role={feedback.error ? "alert" : "status"} className="rounded-lg border bg-card p-4 text-sm">{feedback.message}</p> : null;
}
export function incidentNotice(message: string) { window.dispatchEvent(new CustomEvent("incident-feedback", { detail: { message } })); }

export function IncidentTypeBadge({ type }: { type: IncidentType }) {
  const tone = type === "LOST" ? "bg-amber-100 text-amber-900" : "bg-destructive/10 text-destructive";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{incidentTypeLabels[type]}</span>;
}
export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const tone = status === "REVIEWED" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{incidentStatusLabels[status]}</span>;
}
export function IncidentRequestState({ loading, error, retry, loadingMessage = "Loading incidents…" }: { loading: boolean; error?: string; retry: () => void; loadingMessage?: string }) {
  return loading ? <p role="status" className="rounded-lg border p-6">{loadingMessage}</p>
    : error ? <div role="alert" className="space-y-3 rounded-lg border p-4"><p>{error}</p><Button variant="outline" onClick={retry}>Try again</Button></div> : null;
}
export function IncidentSummary({ incident }: { incident: Incident }) {
  return <div className="space-y-1 text-sm text-muted-foreground">
    <p><span className="font-medium text-foreground">Reason:</span> {incident.reason}</p>
    <p className="whitespace-pre-wrap break-words"><span className="font-medium text-foreground">Description:</span> {incident.description}</p>
  </div>;
}
