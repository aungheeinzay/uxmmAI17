-- Reuse profile membership. Existing Riders and invitations remain valid and unassigned.
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_operator_provider_only";
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_delivery_provider_members_only"
 CHECK ("provider_id" IS NULL OR "role" IN ('OPERATOR', 'RIDER'));
ALTER TABLE "rider_invitations" ADD COLUMN "provider_id" UUID;
ALTER TABLE "rider_invitations" ADD CONSTRAINT "rider_invitations_provider_id_fkey"
 FOREIGN KEY ("provider_id") REFERENCES "legacy_delivery_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "rider_invitations_provider_id_expires_at_idx" ON "rider_invitations"("provider_id", "expires_at");
