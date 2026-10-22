import { RoleGuard } from "@/features/auth/components/role-guard";
import { SellerShell } from "@/features/seller/components/seller-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="SME">
      <SellerShell>{children}</SellerShell>
    </RoleGuard>
  );
}
