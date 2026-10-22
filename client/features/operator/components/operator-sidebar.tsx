"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/shared/brand-logo";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { operatorNavigation, isOperatorRouteActive } from "../config/operator-navigation";
export function OperatorSidebar({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
 const pathname = usePathname();
 return <div className="flex h-full flex-col gap-8 p-4"><Link href="/operator" onClick={onNavigate} aria-label="SURFERTrack dashboard" className="flex h-10 items-center gap-3 font-semibold"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-white p-1 shadow-sm"><BrandLogo className="h-6 w-auto" priority /></span>{!collapsed && <span className="text-xl"><BrandWordmark /></span>}</Link><nav aria-label="Operator navigation" className="space-y-1">{operatorNavigation.map(({ title, href, icon: Icon }) => <Link key={href} href={href} title={collapsed ? title : undefined} aria-label={collapsed ? title : undefined} aria-current={isOperatorRouteActive(pathname, href) ? "page" : undefined} onClick={onNavigate} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${isOperatorRouteActive(pathname, href) ? "bg-secondary font-semibold text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}><Icon aria-hidden="true" className="size-4 shrink-0" />{!collapsed && title}</Link>)}</nav>{!collapsed && <p className="mt-auto rounded-lg border p-3 text-xs leading-5 text-muted-foreground">Know where it is.<br />Your delivery operations, in one place.</p>}</div>;
}
