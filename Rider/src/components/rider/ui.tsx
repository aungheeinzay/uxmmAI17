import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Bell, Box, Check, ChevronRight, Home, MapPin, Package, ScanLine, Shirt, User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Parcel, ParcelStatus } from "@/lib/rider-store";
import { formatMMK } from "@/lib/rider-store";

const statusMap: Record<ParcelStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-warning-soft text-warning" },
  picked_up: { label: "Picked Up", cls: "bg-success-soft text-success" },
  in_transit: { label: "In Transit", cls: "bg-info-soft text-info" },
  out_for_delivery: { label: "Out for Delivery", cls: "bg-warning-soft text-warning" },
  delivered: { label: "Delivered", cls: "bg-success-soft text-success" },
  failed: { label: "Pending Return", cls: "bg-danger-soft text-destructive" },
};

export function StatusBadge({ status }: { status: ParcelStatus }) {
  const s = statusMap[status];
  return <span className={cn("shrink-0 rounded-md px-2 py-1 text-xs font-medium", s.cls)}>{s.label}</span>;
}

export function Logo({ light }: { light?: boolean }) {
  return <div className="flex items-center gap-2.5">
    <img src="/assets/surfertrack-logo.svg" alt="SURFERTrack parcel and location logo" className="h-14 w-14 shrink-0 object-contain" />
    <div className="leading-tight"><p className={cn("text-[19px] font-extrabold tracking-tight",light ? "text-white":"text-[#071443]")}>SURFER<span className="text-[#8fc8ff]">Track</span></p><p className={cn("mt-0.5 text-sm",light?"text-white/90":"text-slate-500")}>Rider</p></div>
  </div>;
}

export function RiderHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-gradient-to-br from-[#063a98] via-[#0755c4] to-[#0879ee] px-5 pb-9 pt-7">
      <div className="flex items-center justify-between">
        <Logo light />
        <div className="flex items-center gap-4">
          <button aria-label="Notifications" className="relative text-primary-foreground">
            <Bell className="h-6 w-6" />
            <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">3</span>
          </button>
          <Link to="/profile" className="flex flex-col items-center">
            <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/70 bg-white/25 text-sm font-semibold text-primary-foreground">KM</div>
            <span className="mt-0.5 text-[10px] font-medium text-primary-foreground">Ko Min Thu</span>
          </Link>
        </div>
      </div>
      {children}
    </header>
  );
}

export function PageHeader({ title, back = "/", dark, right }: { title: string; back?: string; dark?: boolean; right?: ReactNode }) {
  return (
    <header className={cn("flex h-14 items-center justify-between px-4", dark ? "text-primary-foreground" : "text-foreground")}>
      <Link to={back} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="grid h-10 w-10 place-items-center">{right}</div>
    </header>
  );
}

export function SuccessIndicator({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center pb-5 pt-8 text-center">
      <div className="relative grid h-32 w-32 place-items-center rounded-full bg-emerald-50 animate-pop">
        <span className="absolute -left-4 top-6 h-1.5 w-1.5 rounded-full bg-success" />
        <span className="absolute -right-5 top-10 h-1.5 w-1.5 rounded-full bg-info" />
        <span className="absolute -right-2 bottom-2 h-1 w-1 rounded-full bg-success" />
        <div className="grid h-24 w-24 place-items-center rounded-full bg-[#08b66b] shadow-[0_0_0_10px_#d5f7e8]">
          <Check className="h-12 w-12 text-white" strokeWidth={3} />
        </div>
      </div>
      <h2 className="mt-7 text-2xl font-extrabold text-[#071443]">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function ParcelMeta({ p }: { p: Parcel }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">{p.recipient}</p>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> {p.from} → {p.to}
      </p>
    </>
  );
}

export function ParcelCard({ p }: { p: Parcel }) {
  return (
    <Link to={p.status === "pending" || p.status === "picked_up" ? "/parcel/$id" : "/delivery-status/$id"} params={{ id: p.id }} className="flex items-center gap-3 rounded-[18px] bg-white px-3 py-4 shadow-[0_2px_12px_rgba(0,54,122,.05)] active:bg-muted">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted">
        <Box className="h-6 w-6 text-navy" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-navy">{p.id}</p>
          <StatusBadge status={p.status} />
        </div>
        <ParcelMeta p={p} />
        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{p.item} ({p.qty})</span>
          <span className="text-border">|</span>
          <span>{p.weightKg} kg</span>
          {p.codAmount > 0 && (
            <span className="ml-auto rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-destructive">COD {formatMMK(p.codAmount)}</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function ParcelDetailsCard({ p }: { p: Parcel }) {
  return (
    <div className="rounded-[22px] border border-[#edf2fb] bg-white p-4 shadow-[0_5px_24px_rgba(30,80,140,.06)]">
      <div className="flex gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted">
          <Box className="h-6 w-6 text-navy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-navy">{p.id}</p>
            <StatusBadge status={p.status} />
          </div>
          <ParcelMeta p={p} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#fff0f2]">
          <Shirt className="h-7 w-7 text-[#ef8292]" />
        </div>
        <p className="text-sm text-muted-foreground">
          {p.item} ({p.qty}) <span className="mx-2 text-border">|</span> {p.weightKg} kg
        </p>
      </div>
    </div>
  );
}

export function InfoTile({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-[#edf7ff] p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card text-primary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold text-foreground">{value}</p>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const item = (to: "/" | "/deliveries" | "/profile", label: string, Icon: typeof Home) => {
    const active = path === to;
    return (
      <Link to={to} className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-xs", active ? "text-primary" : "text-muted-foreground")}>
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    );
  };
  return (
    <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 items-end border-t border-border bg-card px-2 pb-2">
      {item("/", "Home", Home)}
      {item("/deliveries", "Deliveries", Box)}
      <Link to="/scan" aria-label="Scan" className="-mt-6 flex flex-1 justify-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-card">
          <ScanLine className="h-6 w-6" />
        </span>
      </Link>
      {item("/profile", "Profile", User)}
    </nav>
  );
}
