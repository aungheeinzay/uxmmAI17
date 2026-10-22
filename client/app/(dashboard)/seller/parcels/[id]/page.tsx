import { ParcelDetailsActionBanner } from "@/features/parcels/components/parcel-details-header";
import { ParcelDetailsView } from "@/features/parcels/components/parcel-details-view";

interface ParcelDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const instant = false;

export default async function ParcelDetailsPage({ params }: ParcelDetailsPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <ParcelDetailsActionBanner />
      <main>
        <ParcelDetailsView identifier={id} />
      </main>
    </div>
  );
}
