import type { Metadata } from "next";
import { RoleGuard } from "@/features/auth/components/role-guard";
import { RiderShell } from "@/features/deliveries/components/rider-shell";
import { RiderProfileForm } from "@/features/rider-profile/components/rider-profile-form";

export const metadata: Metadata = {
  title: "Complete your Rider profile | SURFERTrack",
  robots: { index: false, follow: false },
};

export default function RiderCompleteProfilePage() {
  return (
    <RoleGuard role="RIDER">
      <RiderShell>
        <RiderProfileForm />
      </RiderShell>
    </RoleGuard>
  );
}
