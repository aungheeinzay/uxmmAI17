import { Suspense } from "react";
import { RiderDeliveryDetails } from "@/features/deliveries/components/rider-delivery-details";
type Props = { params: Promise<{ id: string }> };
export default function Page(props: Props) { return <Suspense fallback={<p role="status">Loading delivery…</p>}><DetailsRoute {...props} /></Suspense>; }
async function DetailsRoute({ params }: Props) { const { id } = await params; return <RiderDeliveryDetails id={id} />; }
