import { Suspense } from "react";
import { WarehouseManagement } from "@/features/operator/components/warehouse-management";
export default function Page() { return <Suspense fallback={<p role="status">Loading warehouse…</p>}><WarehouseManagement /></Suspense>; }
