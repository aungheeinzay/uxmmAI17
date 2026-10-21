-- New orders use Operator profiles. Preserve historical service assignments as legacy data.

ALTER TABLE "orders" DROP CONSTRAINT "orders_assignment_required";
ALTER TABLE "orders" RENAME COLUMN "delivery_service_id" TO "legacy_delivery_service_id";
ALTER TABLE "orders" RENAME CONSTRAINT "orders_delivery_service_id_fkey" TO "orders_legacy_delivery_service_id_fkey";
ALTER INDEX "orders_delivery_service_id_idx" RENAME TO "orders_legacy_delivery_service_id_idx";
ALTER TABLE "delivery_services" RENAME TO "legacy_delivery_services";
ALTER INDEX "delivery_services_is_active_idx" RENAME TO "legacy_delivery_services_is_active_idx";
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignment_required"
    CHECK ("operator_id" IS NOT NULL OR "legacy_delivery_service_id" IS NOT NULL);