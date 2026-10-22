import { ParcelDetails } from "@/features/operator/components/parcel-details";
import { Suspense } from "react";
type Props = {
  params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }>;
};
export default function Page(props: Props) {
  return <Suspense fallback={<p role="status">Loading parcel details…</p>}><ParcelDetailsRoute {...props} /></Suspense>;
}
async function ParcelDetailsRoute({ params, searchParams }: Props) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const backHref = typeof returnTo === "string" && /^\/operator\/(?:parcels|warehouse|monitoring|assignments|incidents)(?:\?|$|\/)/.test(returnTo) ? returnTo : "/operator/parcels";
  return <ParcelDetails id={id} backHref={backHref} />;
}
