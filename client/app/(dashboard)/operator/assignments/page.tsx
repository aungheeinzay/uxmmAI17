import { OperatorAssignments } from "@/features/deliveries/components/operator-assignments";
import { Suspense } from "react";
import { z } from "zod";
type Props = { searchParams: Promise<{ orderId?: string | string[]; returnTo?: string | string[] }> };
export default function Page(props: Props) { return <Suspense fallback={<p role="status">Loading assignment workspace…</p>}><AssignmentRoute {...props} /></Suspense>; }
async function AssignmentRoute({ searchParams }: Props) {
  const { orderId, returnTo } = await searchParams;
  if (orderId !== undefined && !z.string().uuid().safeParse(orderId).success) return <p role="alert">The selected parcel identifier is invalid.</p>;
  const backHref = typeof returnTo === "string" && /^\/operator\/warehouse(?:\?|$)/.test(returnTo) ? returnTo : "/operator/warehouse";
  return <OperatorAssignments selectedOrderId={typeof orderId === "string" ? orderId : undefined} backHref={backHref} />;
}
