"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { sellerPageMeta } from "../seller-nav";
import { useAuthStore } from "@/stores/auth.store";
import { SellerHeader } from "./seller-header";
import { SellerSidebar } from "./seller-sidebar";

export function SellerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const page = sellerPageMeta(pathname);
  const workspaceName = useAuthStore((state) => state.user?.fullName?.trim() || "Seller workspace");

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex">
        <SellerSidebar />
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-64">
            <SellerSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col overflow-hidden">
        <SellerHeader
          workspaceName={workspaceName}
          currentPageName={page.title}
          showDemoBadge={page.demoBadge}
          onOpenNavigation={() => setOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
