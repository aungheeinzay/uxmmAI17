"use client";

import { ArrowLeft, Bell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParcelDetailsHeaderProps {
  workspaceName?: string;
  currentPageName?: string;
  userInitials?: string;
}

export function ParcelDetailsHeader({
  workspaceName = "Seller workspace",
  currentPageName = "Parcel details",
  userInitials = "SO",
}: ParcelDetailsHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#FFFFFF]">
      <div className="flex h-16 items-center justify-between px-6">
        <nav className="flex items-center space-x-2 text-sm">
          <span className="text-[#64748B]">{workspaceName}</span>
          <ChevronRight className="h-4 w-4 text-[#9CA3AF]" aria-hidden="true" />
          <span className="font-semibold text-[#1B2F5A]">{currentPageName}</span>
        </nav>
        <div className="flex items-center space-x-4">
          <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#3D51A3]">
            DEMO DATA
          </span>
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted/40"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-[#4B5563]" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#F59E0B]" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF2FF]">
            <span className="text-sm font-bold text-[#3D51A3]">{userInitials}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

interface ParcelDetailsActionBannerProps {
  onBack?: () => void;
}

export function ParcelDetailsActionBanner({ onBack }: ParcelDetailsActionBannerProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  return (
    <section className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-6 py-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B7280]">
          PARCELS · SHIPMENT DETAIL
        </p>
        <h1 className="text-[28px] font-bold text-[#1B2F5A]">Parcel details</h1>
        <p className="text-sm text-[#6B7280]">
          Review the shipment, share a tracking code, or update the delivery team.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={handleBack}
        className="h-auto rounded-full border-[#E5E7EB] bg-[#FFFFFF] px-5 py-2.5 font-semibold text-[#111827] shadow-sm hover:bg-[#F9FAFB]"
      >
        <ArrowLeft className="mr-2 h-4 w-4 text-[#111827]" />
        Back
      </Button>
    </section>
  );
}
