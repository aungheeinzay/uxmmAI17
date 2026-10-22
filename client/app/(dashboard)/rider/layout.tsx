import { RoleGuard } from "@/features/auth/components/role-guard";
import { RiderProfileGate } from "@/features/rider-profile/components/rider-profile-gate";
import { RiderShell } from "@/features/deliveries/components/rider-shell";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="RIDER">
      <RiderProfileGate>
        <RiderShell>{children}</RiderShell>
      </RiderProfileGate>
    </RoleGuard>
  );
}
