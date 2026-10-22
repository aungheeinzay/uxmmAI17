-- Existing profiles retain NULL membership; do not infer membership from existing orders.
ALTER TABLE "profiles" ADD COLUMN "provider_id" UUID;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_provider_id_fkey"
 FOREIGN KEY ("provider_id") REFERENCES "legacy_delivery_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "profiles_provider_id_idx" ON "profiles"("provider_id");
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_operator_provider_only"
 CHECK ("provider_id" IS NULL OR "role" = 'OPERATOR');
