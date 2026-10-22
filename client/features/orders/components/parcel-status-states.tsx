"use client";

import { Loader2, PackageSearch, TriangleAlert } from "lucide-react";

const stateShell =
  "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-6 py-12 text-center";

export function ParcelStatusEmptyState() {
  return (
    <div className={`${stateShell} mt-4`}>
      <div className="flex size-14 items-center justify-center rounded-full bg-[#EEF2FF]">
        <PackageSearch aria-hidden="true" className="size-6 text-[#3D51A3]" />
      </div>
      <h3 className="mt-4 text-[16px] font-bold text-[#111827]">No parcel tracked yet</h3>
      <p className="mt-1 max-w-sm text-body-md text-[#6B7280]">
        Enter the parcel or order code from your receipt to see its current delivery status and progress.
      </p>
    </div>
  );
}

export function ParcelStatusLoadingState() {
  return (
    <div className={`${stateShell} mt-4`} role="status">
      <Loader2 aria-hidden="true" className="size-6 animate-spin text-[#3D51A3]" />
      <p className="mt-4 text-body-md font-bold text-[#111827]">Looking up your parcel…</p>
      <p className="mt-1 text-body-sm text-[#6B7280]">This usually takes only a moment.</p>
    </div>
  );
}

export function ParcelStatusErrorState({ message }: { message: string | null }) {
  return (
    <div role="alert" className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-white">
        <TriangleAlert aria-hidden="true" className="size-6 text-red-500" />
      </div>
      <h3 className="mt-4 text-[16px] font-bold text-[#111827]">We couldn’t show that parcel</h3>
      <p className="mt-1 max-w-sm text-body-md text-red-700">{message}</p>
    </div>
  );
}
