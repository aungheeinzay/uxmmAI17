-- Restore the existing catalog in Prisma; preserve its ids and all historical references.
-- Fail safely if pre-existing provider names conflict; never rewrite business data.
CREATE UNIQUE INDEX "legacy_delivery_services_name_key" ON "legacy_delivery_services"("name");
ALTER TABLE "orders" ADD COLUMN "destination_city" VARCHAR(120), ADD COLUMN "delivery_fee" DECIMAL(12,2);
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_fee_nonnegative" CHECK ("delivery_fee" IS NULL OR "delivery_fee" >= 0);
CREATE TABLE "delivery_city_prices" (
 "id" UUID NOT NULL PRIMARY KEY,
 "provider_id" UUID NOT NULL REFERENCES "legacy_delivery_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "city" VARCHAR(120) NOT NULL,
 "fee" DECIMAL(12,2) NOT NULL CHECK ("fee" >= 0),
 "is_active" BOOLEAN NOT NULL DEFAULT true,
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "delivery_city_prices_city_normalized" CHECK ("city" = lower(btrim("city")) AND length("city") > 0)
);
CREATE UNIQUE INDEX "delivery_city_prices_provider_id_city_key" ON "delivery_city_prices"("provider_id", "city");
CREATE INDEX "delivery_city_prices_city_is_active_idx" ON "delivery_city_prices"("city", "is_active");
ALTER TABLE "delivery_city_prices" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "delivery_city_prices" FROM anon, authenticated;
-- Legacy orders deliberately retain NULL city/fee: no historical price can be inferred.
