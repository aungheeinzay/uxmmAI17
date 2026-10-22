export function BrandWordmark({ inverse = false }: { inverse?: boolean } = {}) {
  return <span className={inverse ? "font-bold tracking-tight text-white" : "font-bold tracking-tight text-[var(--brand-navy)]"}>SURFER<span className={inverse ? "text-white/70" : "text-primary"}>Track</span></span>;
}
