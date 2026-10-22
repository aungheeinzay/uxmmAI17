import { cn } from "cn";

export function riderInitials(name: string | null | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "R";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase() || "R";
}

export function RiderAvatar({ name, className, label }: { name?: string | null; className?: string; label?: string }) {
  return (
    <span
      role="img"
      aria-label={label ?? `${name?.trim() || "Rider"} avatar`}
      className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-navy)] text-sm font-bold text-white", className)}
    >
      {riderInitials(name)}
    </span>
  );
}
