-- Additive Rider operational deactivation. Null means active, so every existing Rider,
-- Operator and SME profile remains unchanged and active after this migration.
ALTER TABLE "public"."profiles" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);

-- Supports provider-scoped active/inactive list filters without changing existing rows.
CREATE INDEX "profiles_provider_id_deactivated_at_idx"
    ON "public"."profiles"("provider_id", "deactivated_at");
