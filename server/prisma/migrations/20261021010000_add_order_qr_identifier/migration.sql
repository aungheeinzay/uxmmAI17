-- Feature 4: persist one opaque QR identifier for each parcel.
-- Existing parcels receive independent random identifiers before the field becomes required.

ALTER TABLE "orders" ADD COLUMN "qr_identifier" VARCHAR(64);

UPDATE "orders"
SET "qr_identifier" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "qr_identifier" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "qr_identifier" SET NOT NULL;
CREATE UNIQUE INDEX "orders_qr_identifier_key" ON "orders"("qr_identifier");