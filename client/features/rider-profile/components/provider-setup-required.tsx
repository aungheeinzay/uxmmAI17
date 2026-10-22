import { Link2Off } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ProviderSetupRequired({ compact = false }: { compact?: boolean }) {
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950 *:[svg]:text-amber-700">
      <Link2Off aria-hidden="true" />
      <AlertTitle>Delivery provider setup required</AlertTitle>
      <AlertDescription className="text-amber-900">
        Your Rider account is not linked to a delivery provider yet. Ask your Operator to add you to their provider before you use deliveries.
        {!compact && <p className="mt-2">You can still save your name and vehicle details. Deliveries unlock automatically once the provider is linked.</p>}
      </AlertDescription>
    </Alert>
  );
}
