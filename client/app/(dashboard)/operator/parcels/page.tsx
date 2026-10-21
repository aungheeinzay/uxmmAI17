import { Suspense } from "react";
import { IncomingParcels } from "@/features/operator/components/incoming-parcels";
export default function Page() { return <Suspense fallback={<p role="status">Loading parcels…</p>}><IncomingParcels /></Suspense>; }
