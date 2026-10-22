"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { useOperatorResource } from "@/features/operator/hooks/use-operator-resource";
import { InviteRiderForm } from "./invite-rider-form";
import { EditRiderDialog } from "./edit-rider-dialog";
import { RiderStatusDialog } from "./rider-status-dialog";
import { getRiderDashboard, getManagedRider, riderManagementError } from "../api/rider-management.api";
import { operationalStatusLabels, workloadLabels, type RiderQuery } from "../types/rider-management.types";

const accountStatusLabels = { ACTIVATED: "Activated", UNVERIFIED: "Unverified", NO_ACCOUNT: "No account" } as const;

function ReadOnly({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd>{children}</dd></div>;
}

function RiderDetails({ id, close, onNotice }: { id: string; close: () => void; onNotice: (message: string) => void }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState(false);
  const [statusAction, setStatusAction] = useState<"deactivate" | "reactivate" | null>(null);
  const resource = useOperatorResource(JSON.stringify({ action: "detail", id, page, pageSize }), getManagedRider, riderManagementError);
  const data = resource.data;
  const saved = (message: string) => {
    setEditing(false); setStatusAction(null); onNotice(message);
    window.dispatchEvent(new Event("operator-parcels-changed"));
  };
  return <section aria-label="Rider details" className="space-y-4 rounded-xl border bg-card p-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">Rider Details</h2>{data && <p className="text-sm text-muted-foreground">{operationalStatusLabels[data.rider.isActive ? "ACTIVE" : "INACTIVE"]} Rider · {data.rider.provider.name}</p>}</div>
      <div className="flex flex-wrap gap-2">{data && <><Button variant="outline" onClick={() => setEditing(true)}>Edit Rider</Button>{data.rider.isActive
        ? <Button variant="destructive" onClick={() => setStatusAction("deactivate")}>Deactivate Rider</Button>
        : <Button onClick={() => setStatusAction("reactivate")}>Reactivate Rider</Button>}</>}<Button variant="outline" onClick={close}>Close details</Button></div></div>
    {resource.isLoading && <p role="status">Loading Rider details…</p>}
    {resource.isRefetching && <p role="status" className="text-sm text-muted-foreground">Updating Rider details…</p>}
    {resource.error && <p role="alert">{resource.error} <Button onClick={resource.retry}>Retry details</Button></p>}
    {data && <>
      <h3 className="text-lg font-semibold">{data.rider.fullName ?? "Unnamed Rider"}</h3>
      <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-3">
        <ReadOnly label="Email / account identity">{data.rider.email ?? "No email account"}</ReadOnly>
        <ReadOnly label="Phone number">{data.rider.phone ?? "No phone number"}</ReadOnly>
        <ReadOnly label="Assigned delivery provider">{data.rider.provider.name}</ReadOnly>
        <ReadOnly label="Account activation">{accountStatusLabels[data.rider.accountStatus]}</ReadOnly>
        <ReadOnly label="Operational status"><span className={data.rider.isActive ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{operationalStatusLabels[data.rider.isActive ? "ACTIVE" : "INACTIVE"]}</span>{data.rider.deactivatedAt && <span className="block text-xs text-muted-foreground">Since {new Date(data.rider.deactivatedAt).toLocaleString()}</span>}</ReadOnly>
        <ReadOnly label="Profile completion"><span className={data.rider.profileComplete ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{data.rider.profileComplete ? "Complete" : "Incomplete"}</span>{!data.rider.profileComplete && data.rider.missingFields.length > 0 && <span className="block text-xs text-muted-foreground">Missing: {data.rider.missingFields.join(", ")}</span>}</ReadOnly>
        <ReadOnly label="Vehicle">{data.rider.vehicle.type ? data.rider.vehicle.type.replaceAll("_", " ").toLowerCase() : "Not set"}{data.rider.vehicle.plateNumber ? ` · ${data.rider.vehicle.plateNumber}` : ""}{data.rider.vehicle.model ? ` · ${data.rider.vehicle.model}` : ""}{data.rider.vehicle.color ? ` · ${data.rider.vehicle.color}` : ""}</ReadOnly>
        <ReadOnly label="Workload">{workloadLabels[data.rider.workload]}</ReadOnly>
        <ReadOnly label="Delivery history">{data.rider.activeAssignedTaskCount} active · {data.rider.completedDeliveryCount} delivered (all time in this provider)</ReadOnly>
      </dl>
      <p className="text-sm text-muted-foreground">Assignments are newest first, across all statuses. History shows the latest 20 recorded events per parcel.</p>
      {data.assignments.length === 0 && <p>No assigned parcels.</p>}
      <ul className="space-y-3">{data.assignments.map(task => <li key={task.id} className="space-y-2 rounded-lg border p-3"><Link className="underline" href={`/operator/parcels/${task.orderId}`}>{task.order.orderCode}</Link><p>{task.order.recipientName} · {task.order.destinationCity ?? task.order.township} · {task.order.status}</p><p className="text-sm">Assigned: {new Date(task.assignedAt).toLocaleString()}</p><details><summary>Delivery history</summary><ul>{task.order.statusEvents.map(event => <li key={event.id} className="py-1 text-sm">{event.previousStatus} → {event.status} · {new Date(event.createdAt).toLocaleString()}{event.note ? ` · ${event.note}` : ""}</li>)}</ul></details></li>)}</ul>
      <div className="flex flex-wrap items-center justify-between gap-3"><PageSizeSelect label="Assignments per page" value={pageSize} onChange={value => { setPage(1); setPageSize(value); }} /><div className="flex items-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous assignments</Button><span>Page {page} of {Math.max(1, data.pagination.totalPages)}</span><Button variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next assignments</Button></div></div>
      {editing && <EditRiderDialog rider={data.rider} onClose={() => setEditing(false)} onSaved={() => saved("Rider details updated. Profile completion and workload were refreshed.")} />}
      {statusAction && <RiderStatusDialog rider={data.rider} action={statusAction} onClose={() => setStatusAction(null)} onSaved={(_rider, message) => saved(message)} />}
    </>}
  </section>;
}

export function RiderManagement() {
  const [query, setQuery] = useState<RiderQuery>({ page: 1, pageSize: 20 });
  const [search, setSearch] = useState("");
  const [invitationPage, setInvitationPage] = useState(1);
  const [invitationPageSize, setInvitationPageSize] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const resource = useOperatorResource(JSON.stringify({ action: "list", query, invitationPage, invitationPageSize }), getRiderDashboard, riderManagementError);
  const data = resource.data;
  useEffect(() => {
    const next = search.trim();
    if (next === (query.search ?? "")) return;
    const timer = window.setTimeout(() => {
      setQuery(value => ({ ...value, page: 1, search: next || undefined }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, query.search]);
  const updating = search.trim() !== (query.search ?? "") || resource.isRefetching;
  return <div className="space-y-6"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Rider Management</h1><p className="text-muted-foreground">Delivery workload for your provider. This is task status, not online presence or physical availability.</p></div><Button variant="outline" onClick={() => { resource.retry(); window.dispatchEvent(new Event("operator-parcels-changed")); }}>Refresh</Button></header>
    {resource.isLoading && <p role="status">{resource.isRefetching ? "Refreshing Rider management…" : "Loading Rider management…"}</p>}
    {resource.error && <div role="alert">{resource.error} <Button onClick={resource.retry}>Retry</Button></div>}
    {notice && <p role="status">{notice}</p>}
    {data && <><section aria-label="Rider overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
      ["Total Riders", data.overview.totalRiders], ["No Active Tasks", data.overview.available], ["Assigned / Waiting", data.overview.assigned], ["Delivering", data.overview.delivering], ["Inactive Riders", data.overview.inactive],
    ].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-5"><h2 className="text-sm text-muted-foreground">{label}</h2><p className="mt-2 text-3xl font-semibold">{value}</p></div>)}</section>
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-busy={updating}><h2 className="text-lg font-semibold">Provider Riders</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setQuery(value => ({ ...value, page: 1, search: search.trim() || undefined })); }}>
        <label>Search Riders<Input placeholder="Name, email or phone" value={search} onChange={event => setSearch(event.target.value)} /></label><Button type="submit">Search</Button>
        <label>Rider status<select className="ml-2 rounded-md border bg-background p-2" value={query.status ?? ""} onChange={event => setQuery(value => ({ ...value, page: 1, status: event.target.value ? event.target.value as RiderQuery["status"] : undefined, ...(event.target.value === "INACTIVE" ? { workload: undefined } : {}) }))}><option value="">All Riders</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        <label>Workload<select className="ml-2 rounded-md border bg-background p-2" disabled={query.status === "INACTIVE"} value={query.workload ?? ""} onChange={event => setQuery(value => ({ ...value, page: 1, workload: event.target.value ? event.target.value as RiderQuery["workload"] : undefined }))}><option value="">All workloads</option>{Object.entries(workloadLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {updating && <p role="status" className="ml-auto text-sm text-muted-foreground">Updating Riders…</p>}
      </form>
      <div className="flex justify-end"><PageSizeSelect label="Riders per page" value={query.pageSize} onChange={value => setQuery(current => ({ ...current, page: 1, pageSize: value }))} /></div>
      {data.list.riders.length === 0 ? <p>{data.overview.totalRiders === 0 ? "No Riders in your provider yet. Invite a Rider below, or provision verified existing Riders through the controlled CLI." : "No Riders match your filters."}</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Riders in your provider</caption><thead><tr>{["Rider Name", "Email / Phone", "Account Status", "Operational Status", "Workload Status", "Assigned Tasks", "In Progress", "Actions"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.list.riders.map(rider => <tr key={rider.id} className="border-t"><td className="p-2">{rider.fullName ?? "Unnamed Rider"}</td><td>{rider.email ?? "No email"}<br />{rider.phone ?? "No phone"}</td><td>{accountStatusLabels[rider.accountStatus]}</td><td><span className={rider.isActive ? "font-medium text-emerald-700" : "rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900"}>{operationalStatusLabels[rider.isActive ? "ACTIVE" : "INACTIVE"]}</span></td><td>{workloadLabels[rider.workload]}</td><td>{rider.assignedTaskCount}</td><td>{rider.inProgressDeliveryCount}</td><td><Button variant="outline" onClick={() => { setSelected(rider.id); setNotice(null); }} aria-label={`View ${rider.fullName ?? "Rider"} details`}>View details</Button></td></tr>)}</tbody></table></div>}
      <p className="text-xs text-muted-foreground">Assigned Tasks counts PICKED_UP. In Progress counts IN_TRANSIT and OUT_FOR_DELIVERY. Delivered, failed and cancelled work is not active. Inactive Riders are deactivated operationally and are separate from unactivated accounts.</p>
      <div className="flex items-center gap-3"><Button variant="outline" disabled={query.page <= 1} onClick={() => setQuery(value => ({ ...value, page: value.page - 1 }))}>Previous Riders</Button><span>Page {query.page} of {Math.max(1, data.list.pagination.totalPages)} · {data.list.pagination.total} Riders</span><Button variant="outline" disabled={query.page >= data.list.pagination.totalPages} onClick={() => setQuery(value => ({ ...value, page: value.page + 1 }))}>Next Riders</Button></div>
    </section>
    <section className="space-y-3 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Pending Invitations</h2><p className="text-sm text-muted-foreground">Unactivated invitees are separate from the Rider totals.</p></div><PageSizeSelect label="Invitations per page" value={invitationPageSize} onChange={value => { setInvitationPage(1); setInvitationPageSize(value); }} /></div>{data.pending.invitations.length === 0 ? <p>No pending invitations.</p> : <ul>{data.pending.invitations.map(invitation => <li key={invitation.id} className="border-t py-2">{invitation.fullName ?? "Invited Rider"} · {invitation.email} · Expires {new Date(invitation.expiresAt).toLocaleString()}</li>)}</ul>}
      <div className="flex items-center gap-3"><Button variant="outline" disabled={invitationPage <= 1} onClick={() => setInvitationPage(value => value - 1)}>Previous invitations</Button><span>Page {invitationPage} of {Math.max(1, data.pending.pagination.totalPages)}</span><Button variant="outline" disabled={invitationPage >= data.pending.pagination.totalPages} onClick={() => setInvitationPage(value => value + 1)}>Next invitations</Button></div>
    </section><InviteRiderForm onInvited={() => setNotice("Invitation sent. The Rider has 24 hours to activate their account.")} /></>}
    {selected && <RiderDetails key={selected} id={selected} close={() => setSelected(null)} onNotice={setNotice} />}
  </div>;
}
