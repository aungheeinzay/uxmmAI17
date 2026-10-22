"use client";

import { Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useParcelStatus } from "../hooks/use-parcel-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildShipmentSteps, shipmentStatusBadges } from "./tracking-status";
import { ShipmentStatusPanel } from "./shipment-status-panel";
import {
  ParcelStatusEmptyState,
  ParcelStatusErrorState,
  ParcelStatusLoadingState,
} from "./parcel-status-states";

const sampleCodes = ["PO1B2C3D4E5F67890"];

export function ParcelTracking() {
  const { result, state, error, track } = useParcelStatus();
  const [code, setCode] = useState("");
  const isLoading = state === "loading";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    track(code);
  }

  return (
    <div>
      <header className="bg-[#F8FAFC] px-6 py-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">CUSTOMER EXPERIENCE</p>
        <h1 className="mt-1 text-heading-1 font-bold tracking-tight text-[#1B2F5A]">Public tracking</h1>
        <p className="mt-1 text-body-md text-[#6B7280]">
          A privacy-first tracking page customers can use without signing in.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 px-6 pb-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF]">
              <Search aria-hidden="true" className="size-5 text-[#3D51A3]" />
            </div>
            <h2 className="text-[18px] font-bold text-[#111827]">Track your order</h2>
            <p className="mb-6 mt-1 text-body-md text-[#6B7280]">
              Enter the parcel or order code shared by the shop.
            </p>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="tracking-code" className="text-[12px] font-medium text-[#374151]">
                  Parcel or order code
                </label>
                <Input
                  id="tracking-code"
                  name="trackingCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. PO1B2C3D4E5F67890"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-auto rounded-lg border-[#E5E7EB] px-4 py-3 text-body-md"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="h-auto w-full gap-2 rounded-xl bg-[#3D51A3] py-3 font-semibold text-white hover:bg-[#32438A]"
              >
                <Search aria-hidden="true" className="size-4" />
                {isLoading ? "Tracking…" : "Track parcel"}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 text-[#6B7280]" />
              <p className="text-[12px] text-[#6B7280]">
                Your customer name, phone number, and full delivery address are never shown on public tracking.
              </p>
            </div>

            <p className="mt-4 text-[12px] text-[#9CA3AF]">
              Sample code: {sampleCodes.join(" · ")}
            </p>
          </section>
        </div>

        <div className="lg:col-span-7">
          <section id="tracking-data" className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">SHIPMENT STATUS</p>

            {state === "idle" ? <ParcelStatusEmptyState /> : null}
            {state === "loading" ? <ParcelStatusLoadingState /> : null}
            {state === "error" ? <ParcelStatusErrorState message={error} /> : null}
            {state === "success" && result ? (
              <div className="mt-4">
                <ShipmentStatusPanel
                  parcelId={result.orderCode}
                  recipient="Recipient details hidden"
                  status={shipmentStatusBadges[result.status]}
                  steps={buildShipmentSteps(result.timeline, result.status)}
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
