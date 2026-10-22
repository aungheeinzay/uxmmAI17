import { OperatorIncidentDetail } from "@/features/incidents/components/operator-incident-detail";
type Props = { params: Promise<{ id: string }> };
export default async function Page({ params }: Props) {
  const { id } = await params;
  return <OperatorIncidentDetail id={id} />;
}
