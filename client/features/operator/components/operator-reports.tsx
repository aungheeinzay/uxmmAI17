"use client";

import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, Clock3, Package, RefreshCw, TriangleAlert, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportOverview, reportError } from "../api/reports.api";
import type { ReportOverview, ReportQuery } from "../types/report.types";

type Preset = "today" | "7" | "30" | "custom";
const statusLabels: Record<string, string> = { CREATED: "Created", PICKED_UP: "Picked up", IN_TRANSIT: "In transit", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered", FAILED: "Failed", CANCELLED: "Cancelled" };
const statusColors: Record<string, string> = { CREATED: "bg-slate-400", PICKED_UP: "bg-indigo-400", IN_TRANSIT: "bg-blue-500", OUT_FOR_DELIVERY: "bg-cyan-500", DELIVERED: "bg-emerald-500", FAILED: "bg-red-500", CANCELLED: "bg-slate-600" };
function dateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function rangeFor(preset: Exclude<Preset, "custom">): ReportQuery {
  const end = new Date(); const start = new Date(end);
  if (preset === "7") start.setDate(end.getDate() - 6);
  else if (preset === "30") start.setDate(end.getDate() - 29);
  return { startDate: dateValue(start), endDate: dateValue(end) };
}
function formatValue(value: number | null, suffix = "") { return value === null ? "N/A" : `${value.toLocaleString()}${suffix}`; }

export function OperatorReports() {
  const [preset, setPreset] = useState<Preset>("30");
  const [query, setQuery] = useState<ReportQuery>(() => rangeFor("30"));
  const [draftStart, setDraftStart] = useState(query.startDate);
  const [draftEnd, setDraftEnd] = useState(query.endDate);
  const [data, setData] = useState<ReportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError(null);
      try { setData(await getReportOverview(query)); }
      catch (cause) { if (active) setError(reportError(cause)); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [query, attempt]);
  function selectPreset(next: Exclude<Preset, "custom">) { const nextRange = rangeFor(next); setPreset(next); setQuery(nextRange); setDraftStart(nextRange.startDate); setDraftEnd(nextRange.endDate); }
  function applyCustom() { if (draftEnd < draftStart) { setError("End date must be on or after start date."); return; } setPreset("custom"); setQuery({ startDate: draftStart, endDate: draftEnd }); }
  const maxVolume = Math.max(1, ...(data?.volume.map(item => item.count) ?? [0]));
  const maxStatus = Math.max(1, ...(data?.statusBreakdown.map(item => item.count) ?? [0]));
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="text-3xl font-semibold tracking-tight">Delivery Analytics</h1><p className="mt-1 text-sm text-muted-foreground">Provider-scoped parcel reporting in {data?.period.timezone ?? "Asia/Yangon"}.</p></div><Button variant="outline" onClick={() => setAttempt(value => value + 1)} disabled={loading}><RefreshCw className={loading ? "animate-spin" : undefined} />Refresh</Button></div>
    <Card><CardContent className="flex flex-wrap items-end gap-3 p-4"><div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4" />Reporting period</div>{(["today", "7", "30"] as const).map(value => <Button key={value} variant={preset === value ? "default" : "outline"} onClick={() => selectPreset(value)}>{value === "today" ? "Today" : `Last ${value} Days`}</Button>)}<div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs text-muted-foreground">Start<input type="date" value={draftStart} onChange={event => setDraftStart(event.target.value)} className="h-10 rounded-md border bg-background px-2 text-sm" /></label><label className="grid gap-1 text-xs text-muted-foreground">End<input type="date" value={draftEnd} onChange={event => setDraftEnd(event.target.value)} className="h-10 rounded-md border bg-background px-2 text-sm" /></label><Button variant={preset === "custom" ? "default" : "outline"} onClick={applyCustom}>Apply</Button></div></CardContent></Card>
    {error && <Alert variant="destructive"><AlertTitle>Reports unavailable</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry</Button></AlertDescription></Alert>}
    {loading && !data ? <div className="grid gap-4 md:grid-cols-4"><div className="h-32 animate-pulse rounded-xl bg-muted" /><div className="h-32 animate-pulse rounded-xl bg-muted" /><div className="h-32 animate-pulse rounded-xl bg-muted" /><div className="h-32 animate-pulse rounded-xl bg-muted" /></div> : data ? <>
      <div className="grid gap-4 md:grid-cols-4"><Metric icon={<Package />} label="Total Parcels" value={data.metrics.totalParcels.toLocaleString()} /><Metric icon={<Truck />} label="Success Rate" value={formatValue(data.metrics.successRate, "%")} hint="Delivered ÷ (delivered + failed). Cancelled and in-progress parcels are excluded." /><Metric icon={<TriangleAlert />} label="Failed Deliveries" value={data.metrics.failed.toLocaleString()} /><Metric icon={<Clock3 />} label="Average Delivery Time" value={data.metrics.averageDeliveryHours === null ? "N/A" : `${data.metrics.averageDeliveryHours} h`} hint={data.unavailableMetrics.averageDeliveryHours ?? "First PICKED_UP to DELIVERED status history pair."} /></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-5" />Delivery Volume <span className="text-sm font-normal text-muted-foreground">({data.granularity})</span></CardTitle></CardHeader><CardContent>{data.volume.some(item => item.count > 0) ? <div className="flex h-56 items-end gap-1 overflow-x-auto border-b p-2">{data.volume.map(item => <div key={item.date} className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-muted-foreground">{item.count || ""}</span><div title={`${item.date}: ${item.count}`} className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(item.count ? 8 : 2, (item.count / maxVolume) * 170)}px` }} /><span className="max-w-12 truncate text-[9px] text-muted-foreground">{item.date.slice(data.granularity === "month" ? 0 : 5)}</span></div>)}</div> : <Empty title="No parcels in this period" />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Status Breakdown</CardTitle></CardHeader><CardContent className="space-y-3">{data.statusBreakdown.map(item => <div key={item.status} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm"><span>{statusLabels[item.status]}</span><div className="h-3 rounded-full bg-muted"><div className={`h-3 rounded-full ${statusColors[item.status]}`} style={{ width: `${(item.count / maxStatus) * 100}%` }} /></div><strong className="text-right">{item.count}</strong></div>)}</CardContent></Card>
    </> : <Empty title="No analytics data" />}
  </div>;
}
function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) { return <Card><CardContent className="p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-3 text-3xl font-semibold">{value}</p>{hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}</CardContent></Card>; }
function Empty({ title }: { title: string }) { return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{title}</div>; }
