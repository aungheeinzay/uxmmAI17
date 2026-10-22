"use client";

import { CreateParcelHeader } from "./create-parcel-header";
import { CreateParcelForm } from "./create-parcel-form";

export function CreateParcel() {
  return (
    <div className="pb-10">
      <CreateParcelHeader />

      <div className="mt-6">
        <CreateParcelForm />
      </div>
    </div>
  );
}
